from datetime import UTC, datetime

from bson import ObjectId

from app.database.mongodb import create_account_indexes, get_account_database
from app.models.global_models.user_login import UserLogin
from app.repositories.accounts.role_repository import RoleRepository
from app.repositories.accounts.user_repository import UserRepository


class MetadataRepository:
    @staticmethod
    async def create_metadata(
    _id: ObjectId,
    account_id: str,
    account_name: str,
    email: str
    ) -> ObjectId:

        db = get_account_database(account_id)
        
        document = {
            "_id": _id,
            "account_id": account_id,
            "name": account_name,
            "email": email,
            "created_on": datetime.now(UTC)
        }

        await db.metadata.insert_one(document)

        return _id

    @staticmethod
    async def update_metadata(
        account_id: str,
        account_name: str,
        email: str
    ) -> None:
        db = get_account_database(account_id)
        
        await db.metadata.update_one(
            {
                "account_id": account_id
            },
            {
                "$set": {
                    "name": account_name,
                    "email": email,
                    "updated_on": datetime.now(UTC)
                }
            }
        )

    @staticmethod
    async def initialize_account_database(
        _id: str,
        account_name: str,
        admin_user: UserLogin
    ) -> None:

        account_id = str(_id)

        await MetadataRepository.create_metadata(
            _id=ObjectId(),
            account_id=account_id,
            account_name=account_name,
            email=admin_user.email
        )

        admin_role_id = await RoleRepository.create_default_admin_role(
            account_id=account_id
        )

        await UserRepository.create_default_admin_user(
            _id=admin_user.id,
            account_id=account_id,
            role_id=admin_role_id,
            first_name=admin_user.first_name,
            last_name=admin_user.last_name,
            email=admin_user.email,
            hashed_password=admin_user.database_hash_password
        )

        await create_account_indexes(account_id)

