from datetime import datetime

from bson import ObjectId

from app.models.account.user_model import User
from app.database.mongodb import (
    get_account_database
)


class UserRepository:

    @staticmethod
    async def create(
        account_id: str,
        user: User
    ) -> str:

        db = get_account_database(
            account_id
        )

        result = await db.users.insert_one(
            user.model_dump(by_alias=True)
        )

        return str(
            result.inserted_id
        )
    
    
    
    @staticmethod
    async def create_default_admin_user(
        _id: ObjectId,
        account_id: str,
        role_id: ObjectId,
        first_name: str,
        last_name: str,
        email: str,
        hashed_password: str
    ) -> ObjectId:

        db = get_account_database(account_id)
        
        user = User(
            _id=_id,
            role_id=role_id,
            first_name=first_name,
            last_name=last_name,
            email=email,
            normalized_email=email.strip().upper(),
            hashed_password=hashed_password,
            is_active=True,
            is_principal=True,
            is_first_login=False
        )

        await db.users.insert_one(user.model_dump(by_alias=True))
        
        return _id
    
    @staticmethod
    async def find_by_email(
        account_id: str,
        email: str
    ) -> User | None:

        db = get_account_database(account_id)

        user_data = await db.users.find_one(
            {
                "normalized_email": email.strip().upper(),
                "is_deleted": False
            }
        )

        if user_data:
            return User.model_validate(user_data)

        return None
    
    @staticmethod    
    async def find_by_id(
        account_id: str,
        user_id: str
    ) -> User | None:

        db = get_account_database(account_id)

        user_data = await db.users.find_one(
            {
                "_id": ObjectId(user_id),
                "is_deleted": False
            }
        )

        if user_data:
            return User.model_validate(user_data)

        return None
    
    @staticmethod
    async def update_last_login(
        account_id: str,
        user_id: str
    ) -> None:

        db = get_account_database(account_id)

        await db.users.update_one(
            {
                "_id": ObjectId(user_id)
            },
            {
                "$set": {
                    "last_login": datetime.utcnow()
                }
            }
        )
        
    @staticmethod
    async def update(
        account_id: str,
        user: User
    ) -> None:

        db = get_account_database(account_id)

        await db.users.update_one(
            {
                "_id": user.id
            },
            {
                "$set": user.model_dump(by_alias=True)
            }
        )

    @staticmethod
    async def update_fields(
        account_id: str,
        user_id: str,
        data: dict
    ) -> None:
        db = get_account_database(account_id)
        data["updated_on"] = datetime.utcnow()
        await db.users.update_one(
            {"_id": ObjectId(user_id), "is_deleted": False},
            {"$set": data}
        )

    @staticmethod
    async def update_password(
        account_id: str,
        user_id: str,
        hashed_password: str
    ) -> None:
        await UserRepository.update_fields(
            account_id,
            user_id,
            {"hashed_password": hashed_password}
        )

    @staticmethod
    async def activate(account_id: str, user_id: str) -> None:
        await UserRepository.update_fields(
            account_id,
            user_id,
            {
                "is_active": True,
                "is_first_login": False,
                "last_login": datetime.utcnow()
            }
        )

    @staticmethod
    async def deactivate_by_role(
        account_id: str,
        role_id: str
    ) -> list[str]:
        db = get_account_database(account_id)
        users = await db.users.find({
            "role_id": ObjectId(role_id),
            "is_deleted": False,
            "is_principal": False
        }).to_list(length=None)
        user_ids = [str(user["_id"]) for user in users]

        if user_ids:
            await db.users.update_many(
                {"_id": {"$in": [ObjectId(value) for value in user_ids]}},
                {"$set": {
                    "is_active": False,
                    "is_first_login": False,
                    "updated_on": datetime.utcnow()
                }}
            )

        return user_ids
    
    @staticmethod
    async def delete(
        account_id: str,
        user_id: str
    ) -> None:

        db = get_account_database(account_id)

        await db.users.update_one(
            {
                "_id": ObjectId(user_id)
            },
            {
                "$set": {
                    "is_deleted": True,
                    "deleted_on": datetime.utcnow()
                }
            }
        )
        
    @staticmethod
    async def get_all(
        account_id: str
    ) -> list[User]:

        db = get_account_database(account_id)

        users_data = await db.users.find(
            {
                "is_deleted": False
            }
        ).to_list(length=None)

        return [User.model_validate(user) for user in users_data]
    
