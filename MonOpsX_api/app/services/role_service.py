from bson import ObjectId
from fastapi import HTTPException, status
from pymongo.errors import DuplicateKeyError

from app.models.account.role_model import Role
from app.repositories.accounts.role_repository import RoleRepository
from app.repositories.accounts.user_repository import UserRepository
from app.repositories.global_repo.session_repository import SessionRepository
from app.repositories.global_repo.users_repository import UsersRepository
from app.schemas.role import CreateRoleRequest, UpdateRoleRequest


class RoleService:
    @staticmethod
    def _response(role: Role) -> dict:
        return {
            "id": str(role.id),
            "name": role.name,
            "permissions": role.permissions,
            "is_default": role.is_default
        }

    @staticmethod
    async def get_all(account_id: str) -> list[dict]:
        roles = await RoleRepository.get_all(account_id)
        return [RoleService._response(role) for role in roles]

    @staticmethod
    async def create(account_id: str, request: CreateRoleRequest) -> dict:
        if await RoleRepository.find_by_name(account_id, request.name):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Role name already exists"
            )

        role = Role(
            _id=ObjectId(),
            name=request.name,
            normalized_name=request.name.upper(),
            permissions=request.permissions,
            is_default=False
        )

        try:
            await RoleRepository.create(account_id, role)
        except DuplicateKeyError as error:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Role name already exists"
            ) from error

        return RoleService._response(role)

    @staticmethod
    async def update(
        account_id: str,
        role_id: str,
        request: UpdateRoleRequest
    ) -> dict:
        if not ObjectId.is_valid(role_id):
            raise HTTPException(status_code=404, detail="Role not found")
        role = await RoleRepository.find_by_id(account_id, role_id)
        if role is None:
            raise HTTPException(status_code=404, detail="Role not found")
        if role.is_default:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="The default Admin role cannot be changed"
            )

        existing = await RoleRepository.find_by_name(account_id, request.name)
        if existing and existing.id != role.id:
            raise HTTPException(status_code=409, detail="Role name already exists")

        role.name = request.name
        role.normalized_name = request.name.upper()
        role.permissions = request.permissions

        try:
            await RoleRepository.update(account_id, role)
        except DuplicateKeyError as error:
            raise HTTPException(status_code=409, detail="Role name already exists") from error

        return RoleService._response(role)

    @staticmethod
    async def delete(account_id: str, role_id: str) -> None:
        if not ObjectId.is_valid(role_id):
            raise HTTPException(status_code=404, detail="Role not found")
        role = await RoleRepository.find_by_id(account_id, role_id)
        if role is None:
            raise HTTPException(status_code=404, detail="Role not found")
        if role.is_default:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="The default Admin role cannot be deleted"
            )

        user_ids = await UserRepository.deactivate_by_role(account_id, role_id)
        await UsersRepository.deactivate_many(user_ids)
        await SessionRepository.delete_by_user_ids(user_ids)
        await RoleRepository.delete(account_id, role_id)
