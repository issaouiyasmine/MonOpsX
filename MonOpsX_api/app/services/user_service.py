from bson import ObjectId
from fastapi import HTTPException, status
from pymongo.errors import DuplicateKeyError

from app.models.account.user_model import User
from app.models.global_models.user_login import UserLogin
from app.repositories.accounts.role_repository import RoleRepository
from app.repositories.accounts.user_repository import UserRepository
from app.repositories.global_repo.session_repository import SessionRepository
from app.repositories.global_repo.users_repository import UsersRepository
from app.schemas.user import CreateUserRequest, UpdateUserRequest
from app.utils.password import hash_password


class UserService:
    @staticmethod
    def _response(user: User) -> dict:
        return {
            "id": str(user.id),
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "role_id": str(user.role_id),
            "is_active": user.is_active,
            "is_principal": user.is_principal,
            "is_first_login": user.is_first_login
        }

    @staticmethod
    async def get_all(account_id: str) -> list[dict]:
        users = await UserRepository.get_all(account_id)
        return [UserService._response(user) for user in users]

    @staticmethod
    async def create(account_id: str, request: CreateUserRequest) -> dict:
        if not ObjectId.is_valid(request.role_id):
            raise HTTPException(status_code=404, detail="Role not found")
        role = await RoleRepository.find_by_id(account_id, request.role_id)
        if role is None:
            raise HTTPException(status_code=404, detail="Role not found")
        if await UsersRepository.find_by_email(request.email):
            raise HTTPException(status_code=409, detail="Email is already registered")
        if await UserRepository.find_by_email(account_id, request.email):
            raise HTTPException(status_code=409, detail="Email is already registered")

        user_id = ObjectId()
        password_hash = hash_password(request.temporary_password)
        local_user = User(
            _id=user_id,
            first_name=request.first_name,
            last_name=request.last_name,
            email=request.email,
            normalized_email=request.email.upper(),
            role_id=role.id,
            hashed_password=password_hash,
            is_active=False,
            is_principal=False,
            is_first_login=True
        )
        global_user = UserLogin(
            _id=user_id,
            first_name=request.first_name,
            last_name=request.last_name,
            email=request.email,
            normalized_email=request.email.upper(),
            account_id=account_id,
            database_hash_password=password_hash,
            is_active=False,
            is_principal=False,
            is_first_login=True
        )

        try:
            await UsersRepository.create(global_user)
            try:
                await UserRepository.create(account_id, local_user)
            except Exception:
                await UsersRepository.delete_permanently(str(user_id))
                raise
        except DuplicateKeyError as error:
            raise HTTPException(status_code=409, detail="Email is already registered") from error

        return UserService._response(local_user)

    @staticmethod
    async def update(
        account_id: str,
        user_id: str,
        request: UpdateUserRequest
    ) -> dict:
        if not ObjectId.is_valid(user_id):
            raise HTTPException(status_code=404, detail="User not found")
        user = await UserRepository.find_by_id(account_id, user_id)
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")

        data = request.model_dump(exclude_unset=True)
        if user.is_principal and (
            "role_id" in data
            or data.get("is_active") is False
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="The principal user's role and active status cannot be changed"
            )

        local_updates = {}
        global_updates = {}

        if "role_id" in data:
            if not ObjectId.is_valid(data["role_id"]):
                raise HTTPException(status_code=404, detail="Role not found")
            role = await RoleRepository.find_by_id(account_id, data["role_id"])
            if role is None:
                raise HTTPException(status_code=404, detail="Role not found")
            local_updates["role_id"] = role.id

        if "email" in data:
            existing = await UsersRepository.find_by_email(str(data["email"]))
            if existing and str(existing["_id"]) != user_id:
                raise HTTPException(status_code=409, detail="Email is already registered")
            email = str(data["email"]).strip()
            local_updates.update({"email": email, "normalized_email": email.upper()})
            global_updates.update({"email": email, "normalized_email": email.upper()})

        for field in ("first_name", "last_name", "is_active"):
            if field in data:
                local_updates[field] = data[field]
                global_updates[field] = data[field]

        if data.get("is_active") is False:
            local_updates["is_first_login"] = False
            global_updates["is_first_login"] = False

        await UserRepository.update_fields(account_id, user_id, local_updates)
        await UsersRepository.update_fields(user_id, global_updates)

        if data.get("is_active") is False:
            await SessionRepository.delete_by_user_id(user_id)

        updated = await UserRepository.find_by_id(account_id, user_id)
        return UserService._response(updated)

    @staticmethod
    async def delete(account_id: str, user_id: str) -> None:
        if not ObjectId.is_valid(user_id):
            raise HTTPException(status_code=404, detail="User not found")
        user = await UserRepository.find_by_id(account_id, user_id)
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        if user.is_principal:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="The principal user cannot be deleted"
            )

        await UserRepository.delete(account_id, user_id)
        await UsersRepository.delete(user_id)
        await SessionRepository.delete_by_user_id(user_id)
