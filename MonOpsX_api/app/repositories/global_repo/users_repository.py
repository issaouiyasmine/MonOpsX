from datetime import datetime

from bson import ObjectId

from app.database.mongodb import get_app_database
from app.models.global_models.user_login import UserLogin


class UsersRepository:
    #create a new user in the global database
    @staticmethod
    async def create(user: UserLogin) -> str:
        db = get_app_database()

        result = await db.users.insert_one(
            user.model_dump(by_alias=True)
        )

        return str(result.inserted_id)
    
    #update a user in the global database
    @staticmethod
    async def update(user_id: str, user: dict) -> str:
        db = get_app_database()

        user["updated_at"] = datetime.utcnow()

        result = await db.users.update_one(
            {
                "_id": ObjectId(user_id)
            },
            {
                "$set": user
            }
        )

        return str(result.modified_count)
    
    @staticmethod
    async def find_by_email(email: str):
        db = get_app_database()

        return await db.users.find_one(
            {
                "normalized_email": email.strip().upper(),
                "is_deleted": False
            }
        )

    @staticmethod
    async def delete_permanently(user_id: str) -> None:
        db = get_app_database()
        await db.users.delete_one({"_id": ObjectId(user_id)})
    
    @staticmethod
    async def find_by_id(user_id: str): 
        db = get_app_database()

        return await db.users.find_one(
            {
                "_id": ObjectId(user_id),
                "is_deleted": False
            }
        )
    

    @staticmethod
    async def find_all():
        db = get_app_database()

        return await db.users.find(
            {
                "is_deleted": False
            }
        ).to_list(
            length=None
        )
    
    @staticmethod
    async def delete(user_id: str):                 
        db = get_app_database()

        result = await db.users.update_one(
            {
                "_id": ObjectId(user_id)
            },
            {
                "$set": {
                    "is_deleted": True,
                    "deleted_at": datetime.utcnow()
                }
            }
        )

        return str(result.modified_count)
    
    @staticmethod
    async def update_password(
        user_id: str,
        new_hashed_password: str
    ) -> None:

        db = get_app_database()

        result = await db.users.update_one(
            {
                "_id": user_id
            },
            {
                "$set": {
                    "hash_password": new_hashed_password
                }
            }
        )
        return str(result.modified_count)
    
