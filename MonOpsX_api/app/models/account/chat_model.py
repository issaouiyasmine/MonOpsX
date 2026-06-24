from datetime import datetime
from typing import Optional

from bson import ObjectId
from pydantic import BaseModel, ConfigDict, Field


class ChatMessage(BaseModel):
    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        populate_by_name=True
    )

    id: ObjectId = Field(alias="_id")
    user_id: str
    role: str
    content: str
    server_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
