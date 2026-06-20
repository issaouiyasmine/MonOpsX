import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

from app.repositories.global_repo.server_token_repository import ServerTokenRepository
from app.schemas.webhook import ServerMetricsWebhookRequest
from app.services.webhook_service import WebhookService


class WebhookServiceTests(unittest.IsolatedAsyncioTestCase):
    def build_request(self, **metric_overrides):
        metrics = {
            "cpu_percent": 91,
            "memory_percent": 40,
            "disk_percent": 50,
            "uptime_seconds": 120
        }
        metrics.update(metric_overrides)
        return ServerMetricsWebhookRequest.model_validate({
            "agent_version": "1.0.0",
            "collected_at": datetime.now(timezone.utc),
            "hostname": "server-01",
            "ip": "192.168.1.50",
            "metrics": metrics,
            "docker": {"available": False, "containers": []},
            "events": [{
                "type": "crash",
                "severity": "critical",
                "message": "Container api crashed"
            }]
        })

    def test_hash_token_is_deterministic_and_not_raw(self):
        hashed = ServerTokenRepository.hash_token("secret-token")
        self.assertEqual(hashed, ServerTokenRepository.hash_token("secret-token"))
        self.assertNotEqual(hashed, "secret-token")

    @patch("app.services.webhook_service.ServerTokenRepository.find_active_by_token", new_callable=AsyncMock)
    async def test_resolve_token_rejects_revoked_or_missing_token(self, find_active):
        find_active.return_value = None

        with self.assertRaises(HTTPException) as context:
            await WebhookService.resolve_token("revoked-token")

        self.assertEqual(context.exception.status_code, 401)

    @patch("app.services.webhook_service.ServerRepository.update_latest", new_callable=AsyncMock)
    @patch("app.services.webhook_service.AlertRepository.create_many", new_callable=AsyncMock)
    @patch("app.services.webhook_service.ServerMetricRepository.create", new_callable=AsyncMock)
    @patch("app.services.webhook_service.ServerRepository.find_by_id", new_callable=AsyncMock)
    async def test_ingest_stores_metric_updates_server_and_creates_alerts(
        self,
        find_server,
        create_metric,
        create_alerts,
        update_latest
    ):
        find_server.return_value = object()
        request = self.build_request()

        result = await WebhookService.ingest(
            {"account_id": "account-1", "server_id": "507f1f77bcf86cd799439011"},
            request
        )

        self.assertEqual(result["status"], "degraded")
        self.assertGreaterEqual(result["alerts_created"], 2)
        create_metric.assert_awaited_once()
        create_alerts.assert_awaited_once()
        update_latest.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
