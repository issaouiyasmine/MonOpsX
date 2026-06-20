from datetime import datetime
from typing import Any

from bson import ObjectId
from fastapi import HTTPException, status

from app.core.config import get_settings
from app.models.account.server_model import Alert, ServerMetric
from app.repositories.accounts.alert_repository import AlertRepository
from app.repositories.accounts.server_metric_repository import ServerMetricRepository
from app.repositories.accounts.server_repository import ServerRepository
from app.repositories.global_repo.server_token_repository import ServerTokenRepository
from app.schemas.webhook import ServerMetricsWebhookRequest


settings = get_settings()


class WebhookService:
    @staticmethod
    async def resolve_token(token: str) -> dict:
        token_data = await ServerTokenRepository.find_active_by_token(token)
        if token_data is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid webhook token"
            )

        server = await ServerRepository.find_by_id(
            token_data["account_id"],
            token_data["server_id"]
        )
        if server is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid webhook token"
            )

        return token_data

    @staticmethod
    async def ingest(token_data: dict, request: ServerMetricsWebhookRequest) -> dict:
        account_id = token_data["account_id"]
        server_id = token_data["server_id"]
        server = await ServerRepository.find_by_id(account_id, server_id)
        if server is None:
            raise HTTPException(status_code=404, detail="Server not found")

        metrics = request.metrics.model_dump()
        docker = request.docker.model_dump() if request.docker else None
        events = [event.model_dump() for event in request.events]
        status_value = WebhookService._derive_status(metrics, events)
        latest_metrics = {
            **metrics,
            "docker": docker,
            "events": events,
            "agent_version": request.agent_version,
            "collected_at": request.collected_at
        }

        metric = ServerMetric(
            _id=ObjectId(),
            server_id=ObjectId(server_id),
            agent_version=request.agent_version,
            collected_at=request.collected_at,
            hostname=request.hostname,
            ip=request.ip,
            metrics=metrics,
            docker=docker,
            events=events,
            status=status_value
        )

        alerts = WebhookService._build_alerts(ObjectId(server_id), metrics, events)
        await ServerMetricRepository.create(account_id, metric)
        await AlertRepository.create_many(account_id, alerts)
        await ServerRepository.update_latest(
            account_id=account_id,
            server_id=server_id,
            hostname=request.hostname,
            ip=request.ip,
            status=status_value,
            latest_metrics=latest_metrics,
            last_seen_at=datetime.utcnow()
        )

        return {
            "status": status_value,
            "server_id": server_id,
            "alerts_created": len(alerts)
        }

    @staticmethod
    def _derive_status(metrics: dict[str, Any], events: list[dict[str, Any]]) -> str:
        if any(event["severity"] == "critical" or event["type"] == "crash" for event in events):
            return "degraded"

        if (
            metrics["cpu_percent"] >= settings.METRICS_CPU_ALERT_PERCENT
            or metrics["memory_percent"] >= settings.METRICS_MEMORY_ALERT_PERCENT
            or metrics["disk_percent"] >= settings.METRICS_DISK_ALERT_PERCENT
        ):
            return "degraded"

        return "online"

    @staticmethod
    def _build_alerts(
        server_id: ObjectId,
        metrics: dict[str, Any],
        events: list[dict[str, Any]]
    ) -> list[Alert]:
        alerts: list[Alert] = []
        threshold_map = {
            "cpu_percent": settings.METRICS_CPU_ALERT_PERCENT,
            "memory_percent": settings.METRICS_MEMORY_ALERT_PERCENT,
            "disk_percent": settings.METRICS_DISK_ALERT_PERCENT
        }

        for metric_name, threshold in threshold_map.items():
            metric_value = float(metrics[metric_name])
            if metric_value >= threshold:
                alerts.append(Alert(
                    _id=ObjectId(),
                    server_id=server_id,
                    type="threshold",
                    severity="warning",
                    message=f"{metric_name} reached {metric_value:.1f}% threshold {threshold:.1f}%",
                    metric_name=metric_name,
                    metric_value=metric_value
                ))

        for event in events:
            if event["type"] in {"deployment", "crash", "threshold"} or event["severity"] in {"warning", "critical"}:
                alerts.append(Alert(
                    _id=ObjectId(),
                    server_id=server_id,
                    type=event["type"],
                    severity=event["severity"],
                    message=event["message"]
                ))

        return alerts
