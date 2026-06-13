from datetime import datetime
from typing import Optional

from bson import ObjectId
from pydantic import BaseModel, ConfigDict, Field


class AdminAccountModel(BaseModel):
    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        populate_by_name=True
    )

    id: ObjectId = Field(alias="_id")

    name: str = Field(..., min_length=1)

    email: str = Field(..., min_length=1)

    database_hash_password: Optional[str] = None

    is_deleted: bool = False

    deleted_at: Optional[datetime] = None

    created_at: datetime = Field(
        default_factory=datetime.utcnow
    )

    updated_at: datetime = Field(
        default_factory=datetime.utcnow
    )
