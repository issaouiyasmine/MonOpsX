from datetime import datetime
from typing import Optional

from bson import ObjectId
from pydantic import BaseModel, ConfigDict, Field


class User(BaseModel):
    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        populate_by_name=True
    )

    id: ObjectId = Field(alias="_id")
    first_name: str
    last_name: str
    email: str
    normalized_email: str
    role_id: ObjectId
    hashed_password: str
    is_active: bool = True
    created_on: datetime = Field(default_factory=datetime.utcnow)
    updated_on: datetime = Field(default_factory=datetime.utcnow)
    deleted_on: Optional[datetime] = None
    is_deleted: bool = False
    last_login: Optional[datetime] = None
