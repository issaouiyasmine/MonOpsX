import unittest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch

from bson import ObjectId
from fastapi import HTTPException

from app.models.account.server_model import Server
from app.schemas.server import CreateServerRequest
from app.services.server_service import ServerService


class ServerServiceTests(unittest.IsolatedAsyncioTestCase):
    def build_server(self, status: str, last_seen_at):
        return Server(
            _id=ObjectId(),
            name="Machine locale",
            hostname="localhost",
            ip="127.0.0.1",
            status=status,
            last_seen_at=last_seen_at
        )

    def test_effective_status_keeps_recent_online_status(self):
        now = datetime(2026, 6, 27, 12, 0, 0)
        server = self.build_server("online", now - timedelta(seconds=30))

        self.assertEqual(ServerService._effective_status(server, now), "online")

    def test_effective_status_marks_stale_server_offline(self):
        now = datetime(2026, 6, 27, 12, 0, 0)
        server = self.build_server("online", now - timedelta(seconds=120))

        self.assertEqual(ServerService._effective_status(server, now), "offline")

    def test_effective_status_keeps_pending_when_never_seen(self):
        server = self.build_server("pending", None)

        self.assertEqual(ServerService._effective_status(server), "pending")

    def test_effective_status_keeps_recent_degraded_status(self):
        now = datetime(2026, 6, 27, 12, 0, 0)
        server = self.build_server("degraded", now - timedelta(seconds=30))

        self.assertEqual(ServerService._effective_status(server, now), "degraded")

    @patch("app.services.server_service.token_urlsafe", return_value="server-token")
    @patch("app.services.server_service.ServerTokenRepository.create", new_callable=AsyncMock)
    @patch("app.services.server_service.ServerRepository.create", new_callable=AsyncMock)
    @patch("app.services.server_service.ServerRepository.find_by_ip", new_callable=AsyncMock)
    async def test_create_returns_webhook_token_once(
        self,
        find_by_ip,
        create_server,
        create_token,
        token_urlsafe
    ):
        find_by_ip.return_value = None
        request = CreateServerRequest(
            name="Production API",
            hostname="prod-api-01",
            ip="192.168.1.50"
        )

        result = await ServerService.create("account-1", request)

        self.assertEqual(result["webhook_token"], "server-token")
        self.assertEqual(result["name"], "Production API")
        create_server.assert_awaited_once()
        create_token.assert_awaited_once()
        token_urlsafe.assert_called_once_with(32)

    @patch("app.services.server_service.ServerRepository.find_by_ip", new_callable=AsyncMock)
    async def test_create_rejects_duplicate_ip(self, find_by_ip):
        find_by_ip.return_value = object()

        with self.assertRaises(HTTPException) as context:
            await ServerService.create(
                "account-1",
                CreateServerRequest(name="API", hostname="api", ip="192.168.1.50")
            )

        self.assertEqual(context.exception.status_code, 409)

    @patch("app.services.server_service.token_urlsafe", return_value="new-token")
    @patch("app.services.server_service.ServerTokenRepository.create", new_callable=AsyncMock)
    @patch("app.services.server_service.ServerTokenRepository.revoke_active_for_server", new_callable=AsyncMock)
    @patch("app.services.server_service.ServerRepository.find_by_id", new_callable=AsyncMock)
    async def test_rotate_token_revokes_previous_active_tokens(
        self,
        find_by_id,
        revoke_active,
        create_token,
        token_urlsafe
    ):
        find_by_id.return_value = object()

        result = await ServerService.rotate_token("account-1", "server-1")

        self.assertEqual(result["webhook_token"], "new-token")
        revoke_active.assert_awaited_once_with("account-1", "server-1")
        create_token.assert_awaited_once_with("account-1", "server-1", "new-token")
        token_urlsafe.assert_called_once_with(32)


if __name__ == "__main__":
    unittest.main()
