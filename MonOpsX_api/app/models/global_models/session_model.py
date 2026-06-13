from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SessionModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(alias="_id")
    user_id: str
    refresh_token: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime
