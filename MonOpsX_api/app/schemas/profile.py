from pydantic import BaseModel, EmailStr, Field, field_validator


class ProfileUserResponse(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: EmailStr
    role_id: str
    is_principal: bool


class ProfileAccountResponse(BaseModel):
    id: str
    name: str
    email: EmailStr


class ProfileResponse(BaseModel):
    user: ProfileUserResponse
    account: ProfileAccountResponse


class UpdateProfileUserRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr

    @field_validator("first_name", "last_name", "email", mode="before")
    @classmethod
    def trim_value(cls, value: str) -> str:
        return value.strip()


class UpdateProfileAccountRequest(BaseModel):
    name: str = Field(min_length=3, max_length=100)
    email: EmailStr

    @field_validator("name", "email", mode="before")
    @classmethod
    def trim_value(cls, value: str) -> str:
        return value.strip()
