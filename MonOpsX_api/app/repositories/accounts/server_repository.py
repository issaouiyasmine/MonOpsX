from datetime import datetime
from typing import Any

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.database.mongodb import create_account_indexes, get_account_database
from app.models.account.server_model import Server


class ServerRepository:
    @staticmethod
    async def create(account_id: str, server: Server) -> str:
        db = get_account_database(account_id)
        await create_account_indexes(account_id)
        await db.servers.insert_one({
            "_id": server.id,
            "name": server.name,
            "hostname": server.hostname,
            "ip": server.ip,
            "operating_system": server.operating_system,
            "token": server.token,
            "created_on": server.created_on,
            "updated_on": server.updated_on,
            "is_deleted": False,
            "deleted_on": None
        })
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
    async def update_name(
        account_id: str,
        server_id: str,
        name: str
    ) -> Server | None:
        if not ObjectId.is_valid(server_id):
            return None

        db = get_account_database(account_id)
        result = await db.servers.find_one_and_update(
            {
                "_id": ObjectId(server_id),
                "is_deleted": False
            },
            {
                "$set": {
                    "name": name,
                    "updated_on": datetime.utcnow()
                }
            },
            return_document=ReturnDocument.AFTER
        )
        return Server.model_validate(result) if result else None

    @staticmethod
    async def update_token(
        account_id: str,
        server_id: str,
        token: str
    ) -> Server | None:
        if not ObjectId.is_valid(server_id):
            return None

        db = get_account_database(account_id)
        result = await db.servers.find_one_and_update(
            {
                "_id": ObjectId(server_id),
                "is_deleted": False
            },
            {
                "$set": {
                    "token": token,
                    "updated_on": datetime.utcnow()
                }
            },
            return_document=ReturnDocument.AFTER
        )
        return Server.model_validate(result) if result else None

    @staticmethod
    async def delete(account_id: str, server_id: str) -> bool:
        if not ObjectId.is_valid(server_id):
            return False

        db = get_account_database(account_id)
        result = await db.servers.update_one(
            {
                "_id": ObjectId(server_id),
                "is_deleted": False
            },
            {
                "$set": {
                    "is_deleted": True,
                    "deleted_on": datetime.utcnow(),
                    "updated_on": datetime.utcnow()
                }
            }
        )
        return result.modified_count == 1

    @staticmethod
    async def update_latest(
        account_id: str,
        server_id: str,
        hostname: str,
        ip: str,
        operating_system: str | None,
        status: str,
        latest_metrics: dict[str, Any],
        last_seen_at: datetime
    ) -> None:
        db = get_account_database(account_id)
        try:
            await ServerRepository._update_latest(
                db,
                server_id,
                hostname,
                ip,
                operating_system,
                status,
                latest_metrics,
                last_seen_at
            )
        except DuplicateKeyError:
            await create_account_indexes(account_id)
            await ServerRepository._update_latest(
                db,
                server_id,
                hostname,
                ip,
                operating_system,
                status,
                latest_metrics,
                last_seen_at
            )

    @staticmethod
    async def _update_latest(
        db,
        server_id: str,
        hostname: str,
        ip: str,
        operating_system: str | None,
        status: str,
        latest_metrics: dict[str, Any],
        last_seen_at: datetime
    ) -> None:
        await db.servers.update_one(
            {
                "_id": ObjectId(server_id),
                "is_deleted": False
            },
            {
                "$set": {
                    "hostname": hostname,
                    "ip": ip,
                    "operating_system": operating_system,
                    "status": status,
                    "latest_metrics": latest_metrics,
                    "last_seen_at": last_seen_at,
                    "updated_on": datetime.utcnow()
                }
            }
        )
