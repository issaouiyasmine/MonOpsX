from datetime import datetime

from bson import ObjectId

from app.database.mongodb import get_account_database
from app.models.account.server_model import Alert


class AlertRepository:
    @staticmethod
    async def create_many(account_id: str, alerts: list[Alert]) -> int:
        if not alerts:
            return 0

        db = get_account_database(account_id)
        await db.alerts.insert_many([
            alert.model_dump(by_alias=True)
            for alert in alerts
        ])
        return len(alerts)

    @staticmethod
    async def get_all(
        account_id: str,
        unread: bool | None = None,
        alert_type: str | None = None,
        severity: str | None = None,
        limit: int = 50
    ) -> list[dict]:
        db = get_account_database(account_id)
        query: dict = {}

        if unread is True:
            query["acknowledged_at"] = None
        elif unread is False:
            query["acknowledged_at"] = {"$exists": True, "$ne": None}

        if alert_type and alert_type != "all":
            query["type"] = alert_type

        if severity and severity != "all":
            query["severity"] = severity

        return await db.alerts.find(query).sort("created_at", -1).limit(limit).to_list(length=limit)

    @staticmethod
    async def find_recent_prediction(
        account_id: str,
        server_id: ObjectId,
        metric_name: str,
        since: datetime
    ) -> dict | None:
        db = get_account_database(account_id)
        return await db.alerts.find_one(
            {
                "server_id": server_id,
                "type": "prediction",
                "metric_name": metric_name,
                "created_at": {"$gte": since}
            },
            sort=[("created_at", -1)]
        )

    @staticmethod
    async def mark_read(account_id: str, alert_id: str) -> dict | None:
        if not ObjectId.is_valid(alert_id):
            return None

        db = get_account_database(account_id)
        await db.alerts.update_one(
            {"_id": ObjectId(alert_id)},
            {"$set": {"acknowledged_at": datetime.utcnow()}}
        )
        return await db.alerts.find_one({"_id": ObjectId(alert_id)})

    @staticmethod
    async def mark_all_read(account_id: str) -> int:
        db = get_account_database(account_id)
        result = await db.alerts.update_many(
            {"acknowledged_at": None},
            {"$set": {"acknowledged_at": datetime.utcnow()}}
        )
        return result.modified_count

    @staticmethod
    async def delete(account_id: str, alert_id: str) -> bool:
        if not ObjectId.is_valid(alert_id):
            return False

        db = get_account_database(account_id)
        result = await db.alerts.delete_one({"_id": ObjectId(alert_id)})
        return result.deleted_count == 1

    @staticmethod
    async def delete_all(account_id: str) -> int:
        db = get_account_database(account_id)
        result = await db.alerts.delete_many({})
        return result.deleted_count
