from fastapi import HTTPException, status

from app.repositories.accounts.account_metadata_repository import MetadataRepository
from app.repositories.accounts.user_repository import UserRepository
from app.repositories.global_repo.account_repository import AccountRepository
from app.repositories.global_repo.users_repository import UsersRepository
from app.schemas.profile import UpdateProfileAccountRequest, UpdateProfileUserRequest


class ProfileService:
    @staticmethod
    async def get_profile(account_id: str, user_id: str) -> dict:
        user = await UserRepository.find_by_id(account_id, user_id)
        account = await AccountRepository.find_by_id(account_id)
        if user is None or account is None:
            raise HTTPException(status_code=404, detail="Profile not found")

        return {
            "user": {
                "id": user_id,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "email": user.email,
                "role_id": str(user.role_id),
                "is_principal": user.is_principal,
            },
            "account": {
                "id": account_id,
                "name": account["name"],
                "email": account["email"],
            },
        }

    @staticmethod
    async def update_user(account_id: str, user_id: str, request: UpdateProfileUserRequest) -> dict:
        existing = await UsersRepository.find_by_email(str(request.email))
        if existing and str(existing["_id"]) != user_id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")

        updates = {
            "first_name": request.first_name,
            "last_name": request.last_name,
            "email": str(request.email),
            "normalized_email": str(request.email).upper(),
        }
        await UserRepository.update_fields(account_id, user_id, updates.copy())
        await UsersRepository.update_fields(user_id, updates.copy())
        return await ProfileService.get_profile(account_id, user_id)

    @staticmethod
    async def update_account(account_id: str, user_id: str, request: UpdateProfileAccountRequest) -> dict:
        data = {"name": request.name, "email": str(request.email)}
        await AccountRepository.update(account_id, data.copy())
        await MetadataRepository.update_metadata(account_id, request.name, str(request.email))
        return await ProfileService.get_profile(account_id, user_id)
