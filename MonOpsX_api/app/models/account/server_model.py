from datetime import datetime
from typing import Any, Optional

from bson import ObjectId
from pydantic import BaseModel, ConfigDict, Field


class Server(BaseModel):
    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        populate_by_name=True
    )

    id: ObjectId = Field(alias="_id")
    name: str
    hostname: str
    ip: str
    status: str = "pending"
    latest_metrics: dict[str, Any] = Field(default_factory=dict)
    last_seen_at: Optional[datetime] = None
    created_on: datetime = Field(default_factory=datetime.utcnow)
    updated_on: datetime = Field(default_factory=datetime.utcnow)
    is_deleted: bool = False
    deleted_on: Optional[datetime] = None


class ServerMetric(BaseModel):
    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        populate_by_name=True
    )

    id: ObjectId = Field(alias="_id")
    server_id: ObjectId
    agent_version: str
    collected_at: datetime
    hostname: str
    ip: str
    metrics: dict[str, Any]
    docker: dict[str, Any] | None = None
    events: list[dict[str, Any]] = Field(default_factory=list)
    status: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Alert(BaseModel):
    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        populate_by_name=True
    )

    id: ObjectId = Field(alias="_id")
    server_id: ObjectId
    type: str
    severity: str
    message: str
    metric_name: Optional[str] = None
    metric_value: Optional[float] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    acknowledged_at: Optional[datetime] = None
