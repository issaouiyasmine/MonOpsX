from datetime import datetime
from typing import Optional

from bson import ObjectId
from pydantic import BaseModel, ConfigDict, Field


class UserLogin(BaseModel):
    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        populate_by_name=True
    )

    id: ObjectId = Field(alias="_id")
    first_name: str = Field(..., min_length=1)
    last_name: str = Field(..., min_length=1)
    email: str = Field(..., min_length=1)
    normalized_email: str = Field(..., min_length=1)
    account_id: str = Field(..., min_length=1)
    database_hash_password: Optional[str] = None
    is_email_confirmed: bool = False
    
    is_locked: bool = False
    
    date_locked: Optional[datetime] = None
    
    is_active: bool = True

    is_deleted: bool = False

    deleted_at: Optional[datetime] = None

    created_at: datetime = Field(
        default_factory=datetime.utcnow
    )

    updated_at: datetime = Field(
        default_factory=datetime.utcnow
    )

