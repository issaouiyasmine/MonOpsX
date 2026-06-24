from bson import ObjectId

from app.database.mongodb import get_account_database
from app.models.account.chat_model import ChatMessage


class ChatRepository:
    @staticmethod
    async def create(account_id: str, message: ChatMessage) -> str:
        db = get_account_database(account_id)
        await db.chat_messages.insert_one(message.model_dump(by_alias=True))
        return str(message.id)

    @staticmethod
    async def get_recent(
        account_id: str,
        user_id: str,
        limit: int
    ) -> list[ChatMessage]:
        db = get_account_database(account_id)
        data = await db.chat_messages.find(
            {"user_id": user_id}
        ).sort("created_at", -1).limit(limit).to_list(length=limit)
        return [ChatMessage.model_validate(message) for message in reversed(data)]

    @staticmethod
    async def delete_for_user(account_id: str, user_id: str) -> None:
        db = get_account_database(account_id)
        await db.chat_messages.delete_many({"user_id": user_id})
