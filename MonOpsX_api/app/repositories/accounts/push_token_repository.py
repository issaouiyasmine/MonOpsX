from datetime import datetime

from bson import ObjectId

from app.database.mongodb import get_account_database


class PushTokenRepository:
    @staticmethod
    async def upsert(
        account_id: str,
        user_id: str,
        token: str,
        platform: str | None = None
    ) -> None:
        db = get_account_database(account_id)
        await db.push_tokens.update_one(
            {"user_id": ObjectId(user_id), "token": token},
            {
                "$set": {
                    "user_id": ObjectId(user_id),
                    "token": token,
                    "platform": platform,
                    "updated_at": datetime.utcnow()
                },
                "$setOnInsert": {
                    "_id": ObjectId(),
                    "created_at": datetime.utcnow()
                }
            },
            upsert=True
        )

    @staticmethod
    async def delete(account_id: str, user_id: str, token: str) -> bool:
        db = get_account_database(account_id)
        result = await db.push_tokens.delete_one({
            "user_id": ObjectId(user_id),
            "token": token
        })
        return result.deleted_count == 1

    @staticmethod
    async def get_all_tokens(account_id: str) -> list[str]:
        db = get_account_database(account_id)
        data = await db.push_tokens.find({}, {"token": 1}).to_list(length=None)
        return [
            str(item.get("token"))
            for item in data
            if item.get("token")
        ]
