import re
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


class CreateUserRequest(BaseModel):
    first_name: str = Field(min_length=1)
    last_name: str = Field(min_length=1)
    email: EmailStr
    role_id: str = Field(min_length=1)
    temporary_password: str = Field(min_length=12)

    @field_validator("email", mode="before")
    @classmethod
    def trim_email(cls, value: str) -> str:
        return value.strip()

    @field_validator("temporary_password")
    @classmethod
    def validate_password_size(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must not exceed 72 bytes")
        if not re.search(r"[A-Z]", value):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", value):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", value):
            raise ValueError("Password must contain at least one digit")
        if not re.search(r"[^A-Za-z0-9]", value):
            raise ValueError("Password must contain at least one special character")
        return value


class UpdateUserRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    role_id: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("email", mode="before")
    @classmethod
    def trim_email(cls, value):
        return value.strip() if isinstance(value, str) else value


class UserResponse(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: EmailStr
    role_id: str
    is_active: bool
    is_principal: bool
    is_first_login: bool
