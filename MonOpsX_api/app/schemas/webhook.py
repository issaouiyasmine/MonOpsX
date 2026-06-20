from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


EventType = Literal["deployment", "crash", "threshold", "status", "info"]
EventSeverity = Literal["info", "warning", "critical"]


class WebhookMetrics(BaseModel):
    cpu_percent: float = Field(ge=0, le=100)
    memory_percent: float = Field(ge=0, le=100)
    disk_percent: float = Field(ge=0, le=100)
    uptime_seconds: int = Field(ge=0)


class WebhookDockerContainer(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    image: str = Field(min_length=1, max_length=512)
    status: str = Field(min_length=1, max_length=120)
    restart_count: int = Field(ge=0)


class WebhookDocker(BaseModel):
    available: bool
    containers: list[WebhookDockerContainer] = Field(default_factory=list, max_length=200)


class WebhookEvent(BaseModel):
    type: EventType
    severity: EventSeverity
    message: str = Field(min_length=1, max_length=1000)

    @field_validator("message")
    @classmethod
    def trim_message(cls, value: str) -> str:
        return value.strip()


class ServerMetricsWebhookRequest(BaseModel):
    agent_version: str = Field(min_length=1, max_length=40)
    collected_at: datetime
    hostname: str = Field(min_length=1, max_length=255)
    ip: str = Field(min_length=1, max_length=64)
    metrics: WebhookMetrics
    docker: WebhookDocker | None = None
    events: list[WebhookEvent] = Field(default_factory=list, max_length=100)

    @field_validator("agent_version", "hostname", "ip")
    @classmethod
    def trim_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value is required")
        return value


class ServerMetricsWebhookResponse(BaseModel):
    status: str
    server_id: str
    alerts_created: int
