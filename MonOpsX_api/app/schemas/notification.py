from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class NotificationResponse(BaseModel):
    id: str
    server_id: str
    server_name: Optional[str] = None
    type: str
    severity: str
    message: str
    metric_name: Optional[str] = None
    metric_value: Optional[float] = None
    created_at: datetime
    acknowledged_at: Optional[datetime] = None
    is_read: bool


class MarkAllNotificationsResponse(BaseModel):
    updated: int


class PushTokenRequest(BaseModel):
    token: str = Field(min_length=1)
    platform: Optional[str] = None

    @field_validator("token")
    @classmethod
    def trim_token(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Token obligatoire")
        return value
