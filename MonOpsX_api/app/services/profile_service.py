from fastapi import HTTPException, status

from app.database.mongodb import drop_account_database
from app.repositories.accounts.account_metadata_repository import MetadataRepository
from app.repositories.accounts.user_repository import UserRepository
from app.repositories.global_repo.account_repository import AccountRepository
from app.repositories.global_repo.session_repository import SessionRepository
from app.repositories.global_repo.users_repository import UsersRepository
from app.schemas.profile import (
    DeleteAccountRequest,
    UpdateProfileAccountRequest,
    UpdateProfilePasswordRequest,
    UpdateProfileUserRequest
)
from app.utils.password import hash_password, verify_password


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

    @staticmethod
    async def update_password(account_id: str, user_id: str, request: UpdateProfilePasswordRequest) -> dict:
        global_user = await UsersRepository.find_by_id(user_id)
        if global_user is None:
            raise HTTPException(status_code=404, detail="Profile not found")

        password_hash = global_user.get("database_hash_password")
        if not password_hash or not verify_password(request.current_password, password_hash):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is invalid")

        new_hash = hash_password(request.new_password)
        await UsersRepository.update_password(user_id, new_hash)
        await UserRepository.update_password(account_id, user_id, new_hash)
        return await ProfileService.get_profile(account_id, user_id)

    @staticmethod
    async def delete_account(
        account_id: str,
        user_id: str,
        is_principal: bool,
        request: DeleteAccountRequest
    ) -> None:
        if not is_principal:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the principal admin can delete the account"
            )

        global_user = await UsersRepository.find_by_id(user_id)
        if global_user is None:
            raise HTTPException(status_code=404, detail="Profile not found")

        password_hash = global_user.get("database_hash_password")
        if not password_hash or not verify_password(request.password, password_hash):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is invalid")

        local_users = await UserRepository.get_all(account_id)
        user_ids = [str(user.id) for user in local_users]
        if user_id not in user_ids:
            user_ids.append(user_id)

        await SessionRepository.delete_by_user_ids(user_ids)
        await UsersRepository.deactivate_many(user_ids)
        for account_user_id in user_ids:
            await UsersRepository.delete(account_user_id)

        await AccountRepository.delete(account_id)
        await drop_account_database(account_id)
