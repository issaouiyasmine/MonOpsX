from datetime import datetime
from typing import Optional

from bson import ObjectId
from pydantic import BaseModel, ConfigDict, Field


class Role(BaseModel):
    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        populate_by_name=True
    )

    id: ObjectId = Field(alias="_id")
    name: str
    normalized_name: str = ""
    permissions: list[int] = Field(default_factory=list)
    is_default: bool = False
    created_on: datetime = Field(default_factory=datetime.utcnow)
    updated_on: datetime = Field(default_factory=datetime.utcnow)
    is_deleted: bool = False
    deleted_on: Optional[datetime] = None
