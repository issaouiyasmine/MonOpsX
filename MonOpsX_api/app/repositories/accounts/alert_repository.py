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
