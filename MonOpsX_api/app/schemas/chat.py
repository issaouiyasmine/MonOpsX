from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class ChatMessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    server_id: Optional[str] = Field(default=None, min_length=1)

    @field_validator("message")
    @classmethod
    def trim_message(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Message is required")
        return value

    @field_validator("server_id")
    @classmethod
    def trim_server_id(cls, value: Optional[str]) -> Optional[str]:
        return value.strip() if isinstance(value, str) else value


class ChatMessageResponse(BaseModel):
    id: str
    role: str
    content: str
    server_id: Optional[str] = None
    created_at: datetime


class ChatConversationResponse(BaseModel):
    messages: list[ChatMessageResponse]


class ChatReplyResponse(BaseModel):
    user_message: ChatMessageResponse
    assistant_message: ChatMessageResponse
