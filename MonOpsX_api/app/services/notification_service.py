import asyncio
import json
from datetime import datetime
from typing import Any
from urllib import request

from fastapi import HTTPException, status

from app.models.account.server_model import Alert
from app.repositories.accounts.account_metadata_repository import MetadataRepository
from app.repositories.accounts.alert_repository import AlertRepository
from app.repositories.accounts.push_token_repository import PushTokenRepository
from app.repositories.accounts.server_repository import ServerRepository
from app.schemas.notification import (
    MarkAllNotificationsResponse,
    NotificationResponse,
    PushTokenRequest
)


class NotificationService:
    EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

    @staticmethod
    async def get_all(
        account_id: str,
        unread: bool | None,
        alert_type: str | None,
        severity: str | None,
        limit: int
    ) -> list[NotificationResponse]:
        alerts = await AlertRepository.get_all(
            account_id,
            unread=unread,
            alert_type=alert_type,
            severity=severity,
            limit=limit
        )
        servers = await ServerRepository.get_all(account_id)
        server_names = {str(server.id): server.name for server in servers}
        return [
            NotificationService._to_response(alert, server_names)
            for alert in alerts
        ]

    @staticmethod
    async def mark_read(account_id: str, notification_id: str) -> NotificationResponse:
        alert = await AlertRepository.mark_read(account_id, notification_id)
        if alert is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification introuvable")
        return NotificationService._to_response(alert, {})

    @staticmethod
    async def mark_all_read(account_id: str) -> MarkAllNotificationsResponse:
        updated = await AlertRepository.mark_all_read(account_id)
        return MarkAllNotificationsResponse(updated=updated)

    @staticmethod
    async def delete(account_id: str, notification_id: str) -> None:
        deleted = await AlertRepository.delete(account_id, notification_id)
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification introuvable")

    @staticmethod
    async def delete_all(account_id: str) -> None:
        await AlertRepository.delete_all(account_id)

    @staticmethod
    async def save_push_token(account_id: str, user_id: str, request: PushTokenRequest) -> None:
        await PushTokenRepository.upsert(account_id, user_id, request.token, request.platform)

    @staticmethod
    async def delete_push_token(account_id: str, user_id: str, request: PushTokenRequest) -> None:
        await PushTokenRepository.delete(account_id, user_id, request.token)

    @staticmethod
    async def deliver_alerts(account_id: str, alerts: list[Alert]) -> None:
        if not alerts:
            return

        notification_settings = await MetadataRepository.get_notification_settings(account_id)
        if not notification_settings.get("enabled", True):
            return

        alerts = [
            alert for alert in alerts
            if NotificationService._alert_channel_enabled(alert, notification_settings, "push_enabled")
        ]
        if not alerts:
            return

        tokens = await PushTokenRepository.get_all_tokens(account_id)
        if not tokens:
            return

        messages = []
        for token in tokens:
            for alert in alerts[:5]:
                messages.append({
                    "to": token,
                    "sound": "default",
                    "title": NotificationService._push_title(alert),
                    "body": alert.message,
                    "data": {
                        "notification_id": str(alert.id),
                        "server_id": str(alert.server_id),
                        "type": alert.type,
                        "severity": alert.severity
                    }
                })

        try:
            await asyncio.to_thread(NotificationService._send_expo_messages, messages)
        except Exception:
            # Push delivery must never block metric ingestion.
            return

    @staticmethod
    def _send_expo_messages(messages: list[dict[str, Any]]) -> None:
        payload = json.dumps(messages).encode("utf-8")
        expo_request = request.Request(
            NotificationService.EXPO_PUSH_URL,
            data=payload,
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            method="POST"
        )
        with request.urlopen(expo_request, timeout=8):
            return

    @staticmethod
    def _push_title(alert: Alert) -> str:
        if alert.type == "prediction":
            return "Prediction MonOpsX"
        if alert.type == "threshold":
            return "Seuil maximum atteint"
        if alert.severity == "critical":
            return "Alerte critique MonOpsX"
        return "Notification MonOpsX"

    @staticmethod
    def _alert_channel_enabled(alert: Alert, notification_settings: dict[str, Any], channel: str) -> bool:
        metric_settings = notification_settings.get("metrics") or {}
        if alert.metric_name in metric_settings:
            return bool(metric_settings[alert.metric_name].get(channel, False))

        return any(bool(settings_for_metric.get(channel, False)) for settings_for_metric in metric_settings.values())

    @staticmethod
    def _to_response(alert: dict, server_names: dict[str, str]) -> NotificationResponse:
        server_id = str(alert.get("server_id", ""))
        acknowledged_at = alert.get("acknowledged_at")
        return NotificationResponse(
            id=str(alert.get("_id")),
            server_id=server_id,
            server_name=server_names.get(server_id),
            type=str(alert.get("type", "info")),
            severity=str(alert.get("severity", "info")),
            message=str(alert.get("message", "")),
            metric_name=alert.get("metric_name"),
            metric_value=alert.get("metric_value"),
            created_at=alert.get("created_at") or datetime.utcnow(),
            acknowledged_at=acknowledged_at,
            is_read=acknowledged_at is not None
        )
