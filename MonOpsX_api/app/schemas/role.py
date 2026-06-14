from pydantic import BaseModel, Field, field_validator

from app.utils.permissions import PermissionHelper


class CreateRoleRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    permissions: list[int] = Field(min_length=1)

    @field_validator("name")
    @classmethod
    def trim_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Role name is required")
        return value

    @field_validator("permissions")
    @classmethod
    def validate_permissions(cls, value: list[int]) -> list[int]:
        valid_permissions = set(PermissionHelper.getall_permissions())
        if not value or any(item not in valid_permissions for item in value):
            raise ValueError("Role contains invalid permissions")
        return sorted(set(value))


class UpdateRoleRequest(CreateRoleRequest):
    pass


class RoleResponse(BaseModel):
    id: str
    name: str
    permissions: list[int]
    is_default: bool
