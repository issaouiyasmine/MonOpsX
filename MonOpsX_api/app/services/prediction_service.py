import json
from datetime import datetime, timedelta, timezone
from typing import Any

from bson import ObjectId

from app.core.config import get_settings
from app.models.account.server_model import Alert, ServerMetric
from app.repositories.accounts.alert_repository import AlertRepository
from app.services.ollama_client import OllamaClient


settings = get_settings()


class PredictionService:
    METRICS = {
        "cpu_percent": ("CPU", "METRICS_CPU_ALERT_PERCENT"),
        "memory_percent": ("RAM", "METRICS_MEMORY_ALERT_PERCENT"),
        "disk_percent": ("disque", "METRICS_DISK_ALERT_PERCENT"),
    }

    @staticmethod
    async def build_prediction_alerts(
        account_id: str,
        server_id: ObjectId,
        current_metric: ServerMetric,
        recent_metrics: list[ServerMetric],
        notification_settings: dict[str, Any],
    ) -> list[Alert]:
        if not settings.PREDICTION_ENABLED:
            return []

        metrics_history = PredictionService._ordered_metrics(current_metric, recent_metrics)
        if len(metrics_history) < 3:
            return []

        metric_settings = notification_settings.get("metrics") or {}
        candidates = PredictionService._candidate_predictions(metrics_history, metric_settings)
        if not candidates:
            return []

        if settings.PREDICTION_MODE.lower() == "ollama":
            candidates = await PredictionService._llama_predictions(metrics_history, candidates)

        alerts: list[Alert] = []
        for candidate in candidates:
            metric_name = str(candidate.get("metric_name", ""))
            if metric_name not in PredictionService.METRICS:
                continue

            if await PredictionService._is_in_cooldown(account_id, server_id, metric_name):
                continue

            metric_label = PredictionService.METRICS[metric_name][0]
            message = str(candidate.get("message") or "").strip()
            if not message:
                message = (
                    f"Prediction: risque de charge {metric_label} elevee "
                    f"dans les {settings.PREDICTION_HORIZON_DAYS} prochains jours."
                )

            alerts.append(Alert(
                _id=ObjectId(),
                server_id=server_id,
                type="prediction",
                severity="warning",
                message=message,
                metric_name=metric_name,
                metric_value=PredictionService._latest_value(metrics_history, metric_name),
            ))

        return alerts

    @staticmethod
    def _ordered_metrics(current_metric: ServerMetric, recent_metrics: list[ServerMetric]) -> list[ServerMetric]:
        deduped = {str(current_metric.id): current_metric}
        for metric in recent_metrics:
            deduped[str(metric.id)] = metric

        return sorted(
            deduped.values(),
            key=lambda metric: PredictionService._sort_datetime(metric.collected_at)
        )

    @staticmethod
    def _sort_datetime(value: datetime) -> datetime:
        if value.tzinfo is None:
            return value
        return value.astimezone(timezone.utc).replace(tzinfo=None)

    @staticmethod
    def _candidate_predictions(
        metrics_history: list[ServerMetric],
        metric_settings: dict[str, Any],
    ) -> list[dict[str, Any]]:
        candidates = []

        for metric_name, (metric_label, default_setting_name) in PredictionService.METRICS.items():
            values = [
                float(metric.metrics.get(metric_name))
                for metric in metrics_history
                if isinstance(metric.metrics.get(metric_name), int | float)
            ]
            if len(values) < 3:
                continue

            threshold = PredictionService._metric_threshold(
                metric_settings,
                metric_name,
                float(getattr(settings, default_setting_name)),
            )
            latest = values[-1]
            first = values[0]
            average_step = (latest - first) / max(1, len(values) - 1)
            projected = latest + (average_step * settings.PREDICTION_HORIZON_DAYS)

            is_rising = average_step > 0
            near_threshold = latest >= threshold * 0.80
            will_cross_threshold = projected >= threshold
            if not is_rising or not (near_threshold or will_cross_threshold):
                continue

            candidates.append({
                "metric_name": metric_name,
                "message": (
                    f"Prediction: risque de charge {metric_label} elevee "
                    f"dans les {settings.PREDICTION_HORIZON_DAYS} prochains jours "
                    f"({latest:.1f}% actuellement, projection {projected:.1f}%, seuil {threshold:.1f}%)."
                ),
            })

        return candidates

    @staticmethod
    async def _llama_predictions(
        metrics_history: list[ServerMetric],
        fallback_candidates: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        prompt = PredictionService._prediction_prompt(metrics_history, fallback_candidates)
        try:
            answer = await OllamaClient.chat([
                {
                    "role": "system",
                    "content": (
                        "You analyze server metrics and return only compact JSON. "
                        "Return an array named predictions. Each prediction must include "
                        "metric_name and message. Use metric_name values cpu_percent, "
                        "memory_percent, or disk_percent. Write messages in French."
                    ),
                },
                {"role": "user", "content": prompt},
            ])
        except Exception:
            return fallback_candidates

        parsed = PredictionService._parse_llama_predictions(answer)
        return parsed or fallback_candidates

    @staticmethod
    def _prediction_prompt(
        metrics_history: list[ServerMetric],
        fallback_candidates: list[dict[str, Any]],
    ) -> str:
        samples = [
            {
                "collected_at": metric.collected_at.isoformat(),
                "cpu_percent": metric.metrics.get("cpu_percent"),
                "memory_percent": metric.metrics.get("memory_percent"),
                "disk_percent": metric.metrics.get("disk_percent"),
                "load_average_1m": metric.metrics.get("load_average_1m"),
            }
            for metric in metrics_history[-settings.PREDICTION_METRICS_LIMIT:]
        ]
        return json.dumps({
            "horizon_days": settings.PREDICTION_HORIZON_DAYS,
            "samples": samples,
            "candidate_metrics": [candidate["metric_name"] for candidate in fallback_candidates],
            "expected_output": {
                "predictions": [
                    {
                        "metric_name": "cpu_percent",
                        "message": "Prediction: risque de charge CPU elevee dans les 3 prochains jours."
                    }
                ]
            }
        })

    @staticmethod
    def _parse_llama_predictions(answer: str) -> list[dict[str, Any]]:
        try:
            data = json.loads(answer)
        except json.JSONDecodeError:
            start = answer.find("{")
            end = answer.rfind("}")
            if start == -1 or end == -1 or end <= start:
                return []
            try:
                data = json.loads(answer[start:end + 1])
            except json.JSONDecodeError:
                return []

        predictions = data.get("predictions") if isinstance(data, dict) else None
        if not isinstance(predictions, list):
            return []

        return [
            prediction
            for prediction in predictions
            if isinstance(prediction, dict)
        ]

    @staticmethod
    async def _is_in_cooldown(account_id: str, server_id: ObjectId, metric_name: str) -> bool:
        since = datetime.utcnow() - timedelta(hours=settings.PREDICTION_COOLDOWN_HOURS)
        alert = await AlertRepository.find_recent_prediction(
            account_id,
            server_id,
            metric_name,
            since,
        )
        return alert is not None

    @staticmethod
    def _metric_threshold(metric_settings: dict[str, Any], metric_name: str, default_threshold: float) -> float:
        return float((metric_settings.get(metric_name) or {}).get("threshold", default_threshold))

    @staticmethod
    def _latest_value(metrics_history: list[ServerMetric], metric_name: str) -> float | None:
        for metric in reversed(metrics_history):
            value = metric.metrics.get(metric_name)
            if isinstance(value, int | float):
                return float(value)
        return None
