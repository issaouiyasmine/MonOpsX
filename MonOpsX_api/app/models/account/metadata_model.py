import datetime

from bson import ObjectId
from pydantic import BaseModel


class Metadata(BaseModel):
    _id: ObjectId
    name: str
    email: str
    created_at: datetime
    updated_at: datetime    