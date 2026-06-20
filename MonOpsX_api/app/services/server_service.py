from secrets import token_urlsafe

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo.errors import DuplicateKeyError

from app.models.account.server_model import Server
from app.repositories.accounts.server_metric_repository import ServerMetricRepository
from app.repositories.accounts.server_repository import ServerRepository
from app.repositories.global_repo.server_token_repository import ServerTokenRepository
from app.schemas.server import CreateServerRequest


class ServerService:
    @staticmethod
    def _response(server: Server) -> dict:
        return {
            "id": str(server.id),
            "name": server.name,
            "hostname": server.hostname,
            "ip": server.ip,
            "status": server.status,
            "latest_metrics": server.latest_metrics,
            "last_seen_at": server.last_seen_at
        }

    @staticmethod
    def _metric_response(metric) -> dict:
        return {
            "id": str(metric.id),
            "server_id": str(metric.server_id),
            "agent_version": metric.agent_version,
            "collected_at": metric.collected_at,
            "hostname": metric.hostname,
            "ip": metric.ip,
            "metrics": metric.metrics,
            "docker": metric.docker,
            "events": metric.events,
            "status": metric.status,
            "created_at": metric.created_at
        }

    @staticmethod
    async def get_all(account_id: str) -> list[dict]:
        servers = await ServerRepository.get_all(account_id)
        return [ServerService._response(server) for server in servers]

    @staticmethod
    async def create(account_id: str, request: CreateServerRequest) -> dict:
        existing = await ServerRepository.find_by_ip(account_id, request.ip)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Server IP already exists"
            )

        server = Server(
            _id=ObjectId(),
            name=request.name,
            hostname=request.hostname,
            ip=request.ip
        )
        token = token_urlsafe(32)

        try:
            await ServerRepository.create(account_id, server)
            await ServerTokenRepository.create(account_id, str(server.id), token)
        except DuplicateKeyError as error:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Server IP already exists"
            ) from error

        response = ServerService._response(server)
        response["webhook_token"] = token
        return response

    @staticmethod
    async def rotate_token(account_id: str, server_id: str) -> dict:
        server = await ServerRepository.find_by_id(account_id, server_id)
        if server is None:
            raise HTTPException(status_code=404, detail="Server not found")

        token = token_urlsafe(32)
        await ServerTokenRepository.revoke_active_for_server(account_id, server_id)
        await ServerTokenRepository.create(account_id, server_id, token)
        return {
            "server_id": server_id,
            "webhook_token": token
        }

    @staticmethod
    async def get_metrics(
        account_id: str,
        server_id: str,
        limit: int
    ) -> list[dict]:
        server = await ServerRepository.find_by_id(account_id, server_id)
        if server is None:
            raise HTTPException(status_code=404, detail="Server not found")

        metrics = await ServerMetricRepository.get_recent(account_id, server_id, limit)
        return [ServerService._metric_response(metric) for metric in metrics]
