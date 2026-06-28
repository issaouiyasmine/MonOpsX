from datetime import datetime, timedelta, timezone
from secrets import token_urlsafe

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo.errors import DuplicateKeyError

from app.models.account.server_model import Server
from app.repositories.accounts.server_metric_repository import ServerMetricRepository
from app.repositories.accounts.server_repository import ServerRepository
from app.repositories.global_repo.server_token_repository import ServerTokenRepository
from app.schemas.server import CreateServerRequest, UpdateServerRequest


class ServerService:
    OFFLINE_AFTER_SECONDS = 90

    @staticmethod
    def _response(server: Server, metric=None) -> dict:
        if metric is not None:
            operating_system = metric.operating_system or server.operating_system
            latest_metrics = {
                **metric.metrics,
                "docker": metric.docker,
                "events": metric.events,
                "agent_version": metric.agent_version,
                "operating_system": operating_system,
                "collected_at": metric.collected_at
            }
            status_value = ServerService._effective_status_from_values(
                metric.status,
                metric.collected_at
            )
            last_seen_at = metric.collected_at
        else:
            operating_system = server.operating_system
            latest_metrics = server.latest_metrics
            status_value = ServerService._effective_status(server)
            last_seen_at = server.last_seen_at

        return {
            "id": str(server.id),
            "name": server.name,
            "hostname": server.hostname,
            "ip": server.ip,
            "operating_system": operating_system,
            "status": status_value,
            "latest_metrics": latest_metrics,
            "last_seen_at": last_seen_at,
            "webhook_token": server.token
        }

    @staticmethod
    def _effective_status(server: Server, now: datetime | None = None) -> str:
        return ServerService._effective_status_from_values(
            server.status,
            server.last_seen_at,
            now
        )

    @staticmethod
    def _effective_status_from_values(
        status_value: str,
        last_seen_at: datetime | None,
        now: datetime | None = None
    ) -> str:
        if last_seen_at is None:
            return status_value

        now = now or datetime.utcnow()
        if now.tzinfo is not None:
            now = now.astimezone(timezone.utc).replace(tzinfo=None)

        if last_seen_at.tzinfo is not None:
            last_seen_at = last_seen_at.astimezone(timezone.utc).replace(tzinfo=None)

        if now - last_seen_at > timedelta(seconds=ServerService.OFFLINE_AFTER_SECONDS):
            return "offline"

        return status_value

    @staticmethod
    def _metric_response(metric) -> dict:
        return {
            "id": str(metric.id),
            "server_id": str(metric.server_id),
            "agent_version": metric.agent_version,
            "collected_at": metric.collected_at,
            "hostname": metric.hostname,
            "ip": metric.ip,
            "operating_system": metric.operating_system,
            "metrics": metric.metrics,
            "docker": metric.docker,
            "events": metric.events,
            "status": metric.status,
            "created_at": metric.created_at
        }

    @staticmethod
    async def get_all(account_id: str) -> list[dict]:
        servers = await ServerRepository.get_all(account_id)
        responses = []
        for server in servers:
            metrics = await ServerMetricRepository.get_recent(account_id, str(server.id), 1)
            latest_metric = metrics[0] if metrics else None
            responses.append(ServerService._response(server, latest_metric))
        return responses

    @staticmethod
    async def create(account_id: str, request: CreateServerRequest) -> dict:
        existing = await ServerRepository.find_by_ip(account_id, request.ip)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Adresse IP déjà utilisée"
            )

        token = token_urlsafe(32)
        server = Server(
            _id=ObjectId(),
            name=request.name,
            hostname=request.hostname,
            ip=request.ip,
            token=token
        )

        try:
            await ServerRepository.create(account_id, server)
            await ServerTokenRepository.create(account_id, str(server.id), token)
        except DuplicateKeyError as error:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Adresse IP déjà utilisée"
            ) from error

        return ServerService._response(server)

    @staticmethod
    async def rotate_token(account_id: str, server_id: str) -> dict:
        server = await ServerRepository.find_by_id(account_id, server_id)
        if server is None:
            raise HTTPException(status_code=404, detail="Serveur introuvable")

        token = token_urlsafe(32)
        await ServerTokenRepository.revoke_active_for_server(account_id, server_id)
        await ServerTokenRepository.create(account_id, server_id, token)
        await ServerRepository.update_token(account_id, server_id, token)
        return {
            "server_id": server_id,
            "webhook_token": token
        }

    @staticmethod
    async def update(account_id: str, server_id: str, request: UpdateServerRequest) -> dict:
        server = await ServerRepository.update_name(account_id, server_id, request.name)
        if server is None:
            raise HTTPException(status_code=404, detail="Serveur introuvable")

        return ServerService._response(server)

    @staticmethod
    async def delete(account_id: str, server_id: str) -> None:
        deleted = await ServerRepository.delete(account_id, server_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Serveur introuvable")

        await ServerTokenRepository.revoke_active_for_server(account_id, server_id)

    @staticmethod
    async def get_metrics(
        account_id: str,
        server_id: str,
        limit: int
    ) -> list[dict]:
        server = await ServerRepository.find_by_id(account_id, server_id)
        if server is None:
            raise HTTPException(status_code=404, detail="Serveur introuvable")

        metrics = await ServerMetricRepository.get_recent(account_id, server_id, limit)
        return [ServerService._metric_response(metric) for metric in metrics]
