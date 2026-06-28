from datetime import datetime
from typing import Any

from bson import ObjectId
from fastapi import HTTPException

from app.core.config import get_settings
from app.models.account.chat_model import ChatMessage
from app.repositories.accounts.chat_repository import ChatRepository
from app.repositories.accounts.server_metric_repository import ServerMetricRepository
from app.repositories.accounts.server_repository import ServerRepository
from app.schemas.chat import ChatMessageRequest
from app.services.ollama_client import OllamaClient
from app.services.server_service import ServerService


settings = get_settings()


class ChatService:
    @staticmethod
    def _response(message: ChatMessage) -> dict:
        return {
            "id": str(message.id),
            "role": message.role,
            "content": message.content,
            "server_id": message.server_id,
            "created_at": message.created_at
        }

    @staticmethod
    async def get_history(account_id: str, user_id: str) -> dict:
        messages = await ChatRepository.get_recent(account_id, user_id, settings.CHAT_HISTORY_LIMIT)
        return {"messages": [ChatService._response(message) for message in messages]}

    @staticmethod
    async def clear_history(account_id: str, user_id: str) -> None:
        await ChatRepository.delete_for_user(account_id, user_id)

    @staticmethod
    async def create_reply(
        account_id: str,
        user_id: str,
        request: ChatMessageRequest
    ) -> dict:
        history = await ChatRepository.get_recent(account_id, user_id, settings.CHAT_HISTORY_LIMIT)
        context = await ChatService._build_context(account_id, request.server_id)
        user_message = ChatMessage(
            _id=ObjectId(),
            user_id=user_id,
            role="user",
            content=request.message,
            server_id=request.server_id
        )
        prompt_messages = ChatService._build_prompt(history, context, request.message)
        answer = await OllamaClient.chat(prompt_messages)
        assistant_message = ChatMessage(
            _id=ObjectId(),
            user_id=user_id,
            role="assistant",
            content=answer,
            server_id=request.server_id
        )

        await ChatRepository.create(account_id, user_message)
        await ChatRepository.create(account_id, assistant_message)

        return {
            "user_message": ChatService._response(user_message),
            "assistant_message": ChatService._response(assistant_message)
        }

    @staticmethod
    async def _build_context(account_id: str, server_id: str | None) -> dict[str, Any]:
        if server_id:
            server = await ServerRepository.find_by_id(account_id, server_id)
            if server is None:
                raise HTTPException(status_code=404, detail="Serveur introuvable")
            metrics = await ServerMetricRepository.get_recent(
                account_id,
                server_id,
                settings.CHAT_METRICS_LIMIT
            )
            return {
                "scope": "server",
                "server": ServerService._response(server),
                "metrics": [ServerService._metric_response(metric) for metric in metrics]
            }

        servers = await ServerRepository.get_all(account_id)
        context_servers = []
        for server in servers:
            recent_metrics = await ServerMetricRepository.get_recent(
                account_id,
                str(server.id),
                min(settings.CHAT_METRICS_LIMIT, 20)
            )
            context_servers.append({
                "server": ServerService._response(server),
                "metrics": [ServerService._metric_response(metric) for metric in recent_metrics]
            })

        return {
            "scope": "global",
            "servers": context_servers
        }

    @staticmethod
    def _build_prompt(
        history: list[ChatMessage],
        context: dict[str, Any],
        user_message: str
    ) -> list[dict[str, str]]:
        system = (
            "You are MonOpsX Assistant, an operations chatbot for server monitoring. "
            "Answer questions about servers, CPU, memory, disk, Docker events, crashes, deployments, recaps, and status prediction. "
            "Use only the MonOpsX context provided below for operational facts. "
            "For predictions, infer risk from the saved metrics and clearly say it is an estimate. "
            "If data is missing, say what is missing instead of inventing values. "
            "Be concise, practical, and mention affected servers by name or hostname."
        )
        compact_history = [
            {
                "role": message.role,
                "content": message.content
            }
            for message in history[-10:]
            if message.role in {"user", "assistant"}
        ]
        context_message = {
            "role": "system",
            "content": (
                f"Current UTC time: {datetime.utcnow().isoformat()}Z\n"
                f"MonOpsX saved metrics context:\n{ChatService._compact_context(context)}"
            )
        }

        return [
            {"role": "system", "content": system},
            context_message,
            *compact_history,
            {"role": "user", "content": user_message}
        ]

    @staticmethod
    def _compact_context(context: dict[str, Any]) -> str:
        # Pydantic datetime/ObjectId values have already been converted in service responses.
        import json

        return json.dumps(context, default=str, ensure_ascii=False)[:24000]
