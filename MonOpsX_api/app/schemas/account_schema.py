from datetime import datetime
import re
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


class CreateAccountRequest(BaseModel):
    account_name: str = Field(
        min_length=3,
        max_length=100
    )

    first_name: str

    last_name: str

    email: EmailStr

    password: str = Field(
        min_length=12,
    )

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip()

    @field_validator("password")
    @classmethod
    def validate_password_size(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError(
                "Password must not exceed 72 bytes"
            )

        if not re.search(r"[A-Z]", value):
            raise ValueError(
                "Password must contain at least one uppercase letter"
            )

        if not re.search(r"[a-z]", value):
            raise ValueError(
                "Password must contain at least one lowercase letter"
            )

        if not re.search(r"\d", value):
            raise ValueError(
                "Password must contain at least one digit"
            )

        if not re.search(r"[^A-Za-z0-9]", value):
            raise ValueError(
                "Password must contain at least one special character"
            )

        return value



class UpdateAccountRequest(BaseModel):
    _id: str
    name: Optional[str] = None

    email: Optional[EmailStr] = None

    is_active: Optional[bool] = None


class AccountResponse(BaseModel):
    user_id: str

    account_id: str

    email: EmailStr

    access_token: str

    token_type: str = "bearer"
