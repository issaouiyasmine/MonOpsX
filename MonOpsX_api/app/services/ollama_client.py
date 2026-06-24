import asyncio
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import HTTPException, status

from app.core.config import get_settings


settings = get_settings()


class OllamaClient:
    @staticmethod
    async def chat(messages: list[dict[str, str]]) -> str:
        return await asyncio.to_thread(OllamaClient._chat_sync, messages)

    @staticmethod
    def _chat_sync(messages: list[dict[str, str]]) -> str:
        payload = json.dumps({
            "model": settings.OLLAMA_MODEL,
            "messages": messages,
            "stream": False
        }).encode("utf-8")
        request = Request(
            f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/chat",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )

        try:
            with urlopen(request, timeout=settings.OLLAMA_TIMEOUT_SECONDS) as response:
                data = json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            detail = error.read().decode("utf-8", errors="ignore") or "Ollama request failed"
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail) from error
        except (TimeoutError, URLError) as error:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Ollama is not available"
            ) from error

        content = data.get("message", {}).get("content")
        if not isinstance(content, str) or not content.strip():
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Ollama returned an empty response"
            )

        return content.strip()
