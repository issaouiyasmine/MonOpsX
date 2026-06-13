from contextlib import suppress
from secrets import token_urlsafe

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo.errors import DuplicateKeyError

from app.database.mongodb import (
    create_account_database_user,
    drop_account_database
)
from app.models.global_models.account_model import AdminAccountModel
from app.models.global_models.user_login import UserLogin
from app.repositories.accounts.account_metadata_repository import (
    MetadataRepository
)
from app.repositories.global_repo.account_repository import (
    AccountRepository
)
from app.repositories.global_repo.users_repository import UsersRepository
from app.schemas.account_schema import (
    CreateAccountRequest
)

from app.utils.password import (
    hash_password
)

class AccountService:

    @staticmethod
    async def create_account(
        request: CreateAccountRequest
    ):
        email = request.email.strip()
        normalized_email = email.upper()

        if await UsersRepository.find_by_email(email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email is already registered"
            )

        account_object_id = ObjectId()
        user_object_id = ObjectId()
        account_id = str(account_object_id)
        user_id = str(user_object_id)
        admin_password_hash = hash_password(request.password)
        database_password = token_urlsafe(16)
        database_password_hash = hash_password(database_password)

        account_created = False
        user_created = False

        account = AdminAccountModel(
            _id=account_object_id,
            name=request.account_name,
            email=email,
            database_hash_password=database_password_hash
        )
        admin_user = UserLogin(
            _id=user_object_id,
            first_name=request.first_name,
            last_name=request.last_name,
            email=email,
            normalized_email=normalized_email,
            account_id=account_id,
            database_hash_password=admin_password_hash
        )

        try:
            await AccountRepository.create(account)
            account_created = True

            try:
                await UsersRepository.create(admin_user)
            except DuplicateKeyError as error:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Email is already registered"
                ) from error

            user_created = True

            await create_account_database_user(
                account_id=account_id,
                password=database_password
            )

            await MetadataRepository.initialize_account_database(
                _id=account_id,
                account_name=request.account_name,
                admin_user=admin_user
            )
        except Exception:
            await AccountService._cleanup_failed_creation(
                account_id=account_id,
                user_id=user_id,
                account_created=account_created,
                user_created=user_created
            )
            raise

        return {
            "user_id": user_id,
            "account_id": account_id,
            "email": email
        }

    @staticmethod
    async def rollback_account_creation(
        account_id: str,
        user_id: str
    ) -> None:
        await AccountService._cleanup_failed_creation(
            account_id=account_id,
            user_id=user_id,
            account_created=True,
            user_created=True
        )

    @staticmethod
    async def _cleanup_failed_creation(
        account_id: str,
        user_id: str,
        account_created: bool,
        user_created: bool
    ) -> None:
        with suppress(Exception):
            await drop_account_database(account_id)

        if user_created:
            with suppress(Exception):
                await UsersRepository.delete_permanently(user_id)

        if account_created:
            with suppress(Exception):
                await AccountRepository.delete_permanently(account_id)
