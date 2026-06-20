from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


class CreateServerRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    hostname: str = Field(min_length=1, max_length=255)
    ip: str = Field(min_length=1, max_length=64)

    @field_validator("name", "hostname", "ip")
    @classmethod
    def trim_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value is required")
        return value


class ServerResponse(BaseModel):
    id: str
    name: str
    hostname: str
    ip: str
    status: str
    latest_metrics: dict[str, Any] = Field(default_factory=dict)
    last_seen_at: Optional[datetime] = None


class CreatedServerResponse(ServerResponse):
    webhook_token: str


class RotatedServerTokenResponse(BaseModel):
    server_id: str
    webhook_token: str


class ServerMetricResponse(BaseModel):
    id: str
    server_id: str
    agent_version: str
    collected_at: datetime
    hostname: str
    ip: str
    metrics: dict[str, Any]
    docker: dict[str, Any] | None = None
    events: list[dict[str, Any]] = Field(default_factory=list)
    status: str
    created_at: datetime
