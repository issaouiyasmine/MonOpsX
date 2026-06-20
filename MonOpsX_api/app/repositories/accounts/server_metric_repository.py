from bson import ObjectId

from app.database.mongodb import get_account_database
from app.models.account.server_model import ServerMetric


class ServerMetricRepository:
    @staticmethod
    async def create(account_id: str, metric: ServerMetric) -> str:
        db = get_account_database(account_id)
        await db.server_metrics.insert_one(metric.model_dump(by_alias=True))
        return str(metric.id)

    @staticmethod
    async def get_recent(
        account_id: str,
        server_id: str,
        limit: int
    ) -> list[ServerMetric]:
        db = get_account_database(account_id)
        data = await db.server_metrics.find(
            {"server_id": ObjectId(server_id)}
        ).sort("created_at", -1).limit(limit).to_list(length=limit)
        return [ServerMetric.model_validate(metric) for metric in data]
