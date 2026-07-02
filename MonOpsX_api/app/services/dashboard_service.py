from datetime import datetime, timedelta, timezone
from typing import Any

from app.repositories.accounts.server_metric_repository import ServerMetricRepository
from app.repositories.accounts.server_repository import ServerRepository


class DashboardService:
    PERIODS = {
        "1h": timedelta(hours=1),
        "6h": timedelta(hours=6),
        "24h": timedelta(hours=24),
        "7d": timedelta(days=7),
        "30d": timedelta(days=30),
    }
    EVENT_TYPES = ("all", "deployment", "crash", "threshold", "status", "info")
    LATEST_HISTORY_LIMIT = 48

    @staticmethod
    def range_from_period(period: str) -> tuple[datetime, datetime]:
        now = datetime.utcnow()
        return now - DashboardService.PERIODS.get(period, DashboardService.PERIODS["24h"]), now

    @staticmethod
    def parse_datetime(value: str | None, fallback: datetime) -> datetime:
        if not value:
            return fallback
        normalized = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
        if parsed.tzinfo is not None:
            parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
        return parsed

    @staticmethod
    async def get_account_dashboard(
        account_id: str,
        period: str = "24h",
        server_id: str | None = None,
        event_type: str = "all"
    ) -> dict[str, Any]:
        start, end = DashboardService.range_from_period(period)
        return await DashboardService._build_dashboard_for_account(
            account_id,
            start,
            end,
            server_id,
            event_type
        )

    @staticmethod
    async def get_internal_dashboard(
        start: datetime,
        end: datetime,
        account_id: str | None = None,
        server_id: str | None = None,
        event_type: str = "all"
    ) -> dict[str, Any]:
        servers_payload: list[dict[str, str]] = []
        points: list[dict[str, Any]] = []
        events: list[dict[str, Any]] = []
        summary = {"servers": 0, "online": 0, "degraded": 0, "offline": 0, "containers": 0, "points": 0, "events": 0}
        history_source = "range"

        if not account_id:
            return {
                "summary": summary,
                "summary_rows": DashboardService._summary_rows(summary),
                "servers": servers_payload,
                "points": points,
                "events": events,
                "event_types": list(DashboardService.EVENT_TYPES),
                "history_source": history_source,
            }

        accounts = [{"_id": account_id}]

        for account in accounts:
            current_account_id = str(account.get("_id", ""))
            if not current_account_id:
                continue
            account_payload = await DashboardService._build_dashboard_for_account(
                current_account_id,
                start,
                end,
                server_id,
                event_type
            )
            servers_payload.extend(account_payload["servers"])
            points.extend(account_payload["points"])
            events.extend(account_payload["events"])
            if account_payload.get("history_source") == "latest_available":
                history_source = "latest_available"
            for key in ("servers", "online", "degraded", "offline", "containers", "points", "events"):
                summary[key] += int(account_payload["summary"].get(key, 0))

        return {
            "summary": summary,
            "summary_rows": DashboardService._summary_rows(summary),
            "servers": servers_payload,
            "points": points,
            "events": events,
            "event_types": list(DashboardService.EVENT_TYPES),
            "history_source": history_source,
        }

    @staticmethod
    async def get_internal_servers(account_id: str | None = None) -> list[dict[str, str]]:
        servers: list[dict[str, str]] = [{"label": "Tous les serveurs", "value": "all"}]
        if not account_id:
            return servers

        accounts = [{"_id": account_id}]

        for account in accounts:
            current_account_id = str(account.get("_id", ""))
            if not current_account_id:
                continue
            for server in await ServerRepository.get_all(current_account_id):
                servers.append({
                    "label": server.name or server.hostname or str(server.id),
                    "value": str(server.id),
                })
        return servers

    @staticmethod
    async def _build_dashboard_for_account(
        account_id: str,
        start: datetime,
        end: datetime,
        server_id: str | None,
        event_type: str
    ) -> dict[str, Any]:
        event_type = event_type if event_type in DashboardService.EVENT_TYPES else "all"
        servers = await ServerRepository.get_all(account_id)
        if server_id and server_id not in {"all", ".*"}:
            servers = [server for server in servers if str(server.id) == server_id]

        points: list[dict[str, Any]] = []
        events: list[dict[str, Any]] = []
        containers_count = 0
        history_source = "range"
        servers_payload = [
            {
                "id": str(server.id),
                "name": server.name,
                "hostname": server.hostname,
                "ip": server.ip,
                "status": server.status,
            }
            for server in servers
        ]

        for server in servers:
            server_metrics = await ServerMetricRepository.get_range(
                account_id,
                str(server.id),
                start,
                end,
                event_type if event_type != "all" else None
            )
            if not server_metrics:
                server_metrics = await ServerMetricRepository.get_latest_available(
                    account_id,
                    str(server.id),
                    DashboardService.LATEST_HISTORY_LIMIT,
                    event_type if event_type != "all" else None
                )
                if server_metrics:
                    history_source = "latest_available"

            if server_metrics:
                docker = server_metrics[-1].docker or {}
                containers_count += len(docker.get("containers", []) or [])
            for metric in server_metrics:
                point = DashboardService._point_from_metric(server, metric)
                points.append(point)
                events.extend(DashboardService._events_from_metric(server, metric, event_type))

        points.sort(key=lambda point: point["collected_at"])
        events.sort(key=lambda event: event["collected_at"], reverse=True)

        summary = {
            "servers": len(servers),
            "online": len([server for server in servers if server.status == "online"]),
            "degraded": len([server for server in servers if server.status == "degraded"]),
            "offline": len([server for server in servers if server.status == "offline"]),
            "containers": containers_count,
            "points": len(points),
            "events": len(events),
        }

        return {
            "summary": summary,
            "summary_rows": DashboardService._summary_rows(summary),
            "servers": servers_payload,
            "points": points,
            "events": events,
            "event_types": list(DashboardService.EVENT_TYPES),
            "history_source": history_source,
        }

    @staticmethod
    def _summary_rows(summary: dict[str, int]) -> list[dict[str, int | str]]:
        return [
            {"metric": "Serveurs", "value": summary.get("servers", 0)},
            {"metric": "En ligne", "value": summary.get("online", 0)},
            {"metric": "Degrades", "value": summary.get("degraded", 0)},
            {"metric": "Hors ligne", "value": summary.get("offline", 0)},
            {"metric": "Conteneurs", "value": summary.get("containers", 0)},
            {"metric": "Points", "value": summary.get("points", 0)},
            {"metric": "Evenements", "value": summary.get("events", 0)},
        ]

    @staticmethod
    def _point_from_metric(server, metric) -> dict[str, Any]:
        return {
            "server_id": str(server.id),
            "server": server.name or metric.hostname,
            "hostname": metric.hostname,
            "ip": metric.ip,
            "collected_at": metric.collected_at.isoformat(),
            "status": metric.status,
            "cpu_percent": metric.metrics.get("cpu_percent"),
            "memory_percent": metric.metrics.get("memory_percent"),
            "disk_percent": metric.metrics.get("disk_percent"),
            "load_average_1m": metric.metrics.get("load_average_1m"),
            "uptime_seconds": metric.metrics.get("uptime_seconds"),
        }

    @staticmethod
    def _events_from_metric(server, metric, event_type: str) -> list[dict[str, Any]]:
        events = []
        for event in metric.events:
            if event_type != "all" and event.get("type") != event_type:
                continue
            events.append({
                "server_id": str(server.id),
                "server": server.name or metric.hostname,
                "hostname": metric.hostname,
                "ip": metric.ip,
                "collected_at": metric.collected_at.isoformat(),
                "type": event.get("type", "info"),
                "severity": event.get("severity", "info"),
                "message": event.get("message", ""),
            })
        return events
