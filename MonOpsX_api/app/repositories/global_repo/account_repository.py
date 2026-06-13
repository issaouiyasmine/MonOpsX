from datetime import datetime

from bson import ObjectId

from app.database.mongodb import get_app_database
from app.models.global_models.account_model import AdminAccountModel
from app.models.global_models.user_login import UserLogin


class AccountRepository:

    @staticmethod
    async def create(account: AdminAccountModel) -> str:
        db = get_app_database()

        result = await db.accounts.insert_one(
            account.model_dump(by_alias=True)
        )

        return str(result.inserted_id)

    @staticmethod
    async def find_by_id(
        account_id: str
    ):

        db = get_app_database()

        return await db.accounts.find_one(
            {
                "_id": ObjectId(
                    account_id
                )
            }
        )

    @staticmethod
    async def find_by_email(
        email: str
    ):

        db = get_app_database()
        user_data = await db.users.find_one(
            {
                "normalized_email": email.strip().upper(),
                "is_deleted": False
            }
        )

        if user_data is None:
            return None

        user = UserLogin.model_validate(user_data)

        return await db.accounts.find_one({
            "_id": ObjectId(
                user.account_id
            )
        })

    @staticmethod
    async def delete_permanently(account_id: str) -> None:
        db = get_app_database()
        await db.accounts.delete_one({"_id": ObjectId(account_id)})

    @staticmethod
    async def find_all():

        db = get_app_database()

        return await db.accounts.find({
            "is_deleted": False
        }).to_list(
            length=None
        )

    @staticmethod
    async def update(
        account_id: str,
        data: dict
    ):

        db = get_app_database()

        data["updated_at"] = (
            datetime.utcnow()
        )

        await db.accounts.update_one(
            {
                "_id": ObjectId(
                    account_id
                )
            },
            {
                "$set": data
            }
        )

    @staticmethod
    async def delete(
        account_id: str
    ):

        db = get_app_database()

        await db.accounts.update_one(
            {
                "_id": ObjectId(account_id)
            },
            {
                "$set": {
                    "is_deleted": True,
                    "deleted_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
            }
        )
    
