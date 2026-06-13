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
        user: dict
    ):

        db = get_account_database(
            account_id
        )

        result = await db.users.insert_one(
            user
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
            is_active=True
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
                "_id": user_id
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
    async def delete(
        account_id: str,
        user_id: str
    ) -> None:

        db = get_account_database(account_id)

        await db.users.update_one(
            {
                "_id": user_id
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
    
