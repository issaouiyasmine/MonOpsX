from datetime import datetime
from hashlib import sha256

from bson import ObjectId

from app.database.mongodb import get_app_database


class ServerTokenRepository:
    @staticmethod
    def hash_token(token: str) -> str:
        return sha256(token.encode("utf-8")).hexdigest()

    @staticmethod
    async def create(
        account_id: str,
        server_id: str,
        token: str
    ) -> None:
        db = get_app_database()
        await db.server_webhook_tokens.insert_one({
            "_id": ObjectId(),
            "token_hash": ServerTokenRepository.hash_token(token),
            "account_id": account_id,
            "server_id": server_id,
            "created_on": datetime.utcnow(),
            "revoked_at": None
        })

    @staticmethod
    async def find_active_by_token(token: str) -> dict | None:
        db = get_app_database()
        return await db.server_webhook_tokens.find_one({
            "token_hash": ServerTokenRepository.hash_token(token),
            "revoked_at": None
        })

    @staticmethod
    async def revoke_active_for_server(
        account_id: str,
        server_id: str
    ) -> None:
        db = get_app_database()
        await db.server_webhook_tokens.update_many(
            {
                "account_id": account_id,
                "server_id": server_id,
                "revoked_at": None
            },
            {"$set": {"revoked_at": datetime.utcnow()}}
        )
