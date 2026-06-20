from datetime import datetime
from typing import Any

from bson import ObjectId

from app.database.mongodb import get_account_database
from app.models.account.server_model import Server


class ServerRepository:
    @staticmethod
    async def create(account_id: str, server: Server) -> str:
        db = get_account_database(account_id)
        await db.servers.insert_one(server.model_dump(by_alias=True))
        return str(server.id)

    @staticmethod
    async def find_by_id(account_id: str, server_id: str) -> Server | None:
        if not ObjectId.is_valid(server_id):
            return None

        db = get_account_database(account_id)
        data = await db.servers.find_one({
            "_id": ObjectId(server_id),
            "is_deleted": False
        })
        return Server.model_validate(data) if data else None

    @staticmethod
    async def find_by_ip(account_id: str, ip: str) -> Server | None:
        db = get_account_database(account_id)
        data = await db.servers.find_one({
            "ip": ip,
            "is_deleted": False
        })
        return Server.model_validate(data) if data else None

    @staticmethod
    async def get_all(account_id: str) -> list[Server]:
        db = get_account_database(account_id)
        data = await db.servers.find({"is_deleted": False}).sort("name", 1).to_list(length=None)
        return [Server.model_validate(server) for server in data]

    @staticmethod
    async def update_latest(
        account_id: str,
        server_id: str,
        hostname: str,
        ip: str,
        status: str,
        latest_metrics: dict[str, Any],
        last_seen_at: datetime
    ) -> None:
        db = get_account_database(account_id)
        await db.servers.update_one(
            {
                "_id": ObjectId(server_id),
                "is_deleted": False
            },
            {
                "$set": {
                    "hostname": hostname,
                    "ip": ip,
                    "status": status,
                    "latest_metrics": latest_metrics,
                    "last_seen_at": last_seen_at,
                    "updated_on": datetime.utcnow()
                }
            }
        )
