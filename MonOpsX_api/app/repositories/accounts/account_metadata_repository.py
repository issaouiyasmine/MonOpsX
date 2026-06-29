from datetime import UTC, datetime

from bson import ObjectId

from app.database.mongodb import create_account_indexes, get_account_database
from app.models.global_models.user_login import UserLogin
from app.repositories.accounts.role_repository import RoleRepository
from app.repositories.accounts.user_repository import UserRepository


class MetadataRepository:
    DEFAULT_NOTIFICATION_SETTINGS = {
        "enabled": True,
        "metrics": {
            "cpu_percent": {
                "threshold": 85,
                "in_app_enabled": True,
                "push_enabled": False
            },
            "memory_percent": {
                "threshold": 85,
                "in_app_enabled": True,
                "push_enabled": False
            },
            "disk_percent": {
                "threshold": 90,
                "in_app_enabled": True,
                "push_enabled": False
            }
        }
    }

    @staticmethod
    async def create_metadata(
    _id: ObjectId,
    account_id: str,
    account_name: str,
    email: str
    ) -> ObjectId:

        db = get_account_database(account_id)
        
        document = {
            "_id": _id,
            "account_id": account_id,
            "name": account_name,
            "email": email,
            "notification_settings": MetadataRepository.DEFAULT_NOTIFICATION_SETTINGS,
            "created_on": datetime.now(UTC)
        }

        await db.metadata.insert_one(document)

        return _id

    @staticmethod
    async def update_metadata(
        account_id: str,
        account_name: str,
        email: str
    ) -> None:
        db = get_account_database(account_id)
        
        await db.metadata.update_one(
            {
                "account_id": account_id
            },
            {
                "$set": {
                    "name": account_name,
                    "email": email,
                    "updated_on": datetime.now(UTC)
                }
            }
        )

    @staticmethod
    async def initialize_account_database(
        _id: str,
        account_name: str,
        admin_user: UserLogin
    ) -> None:

        account_id = str(_id)

        await MetadataRepository.create_metadata(
            _id=ObjectId(),
            account_id=account_id,
            account_name=account_name,
            email=admin_user.email
        )

        admin_role_id = await RoleRepository.create_default_admin_role(
            account_id=account_id
        )

        await UserRepository.create_default_admin_user(
            _id=admin_user.id,
            account_id=account_id,
            role_id=admin_role_id,
            first_name=admin_user.first_name,
            last_name=admin_user.last_name,
            email=admin_user.email,
            hashed_password=admin_user.database_hash_password
        )

        await create_account_indexes(account_id)

    @staticmethod
    async def get_notification_settings(account_id: str) -> dict:
        db = get_account_database(account_id)
        metadata = await db.metadata.find_one({"account_id": account_id})
        return MetadataRepository.normalize_notification_settings(
            (metadata or {}).get("notification_settings") or {}
        )

    @staticmethod
    def normalize_notification_settings(settings: dict) -> dict:
        default_settings = MetadataRepository.DEFAULT_NOTIFICATION_SETTINGS
        channel = settings.get("channel")
        thresholds = settings.get("thresholds") or {}
        metrics = settings.get("metrics") or {}
        legacy_in_app_enabled = bool(settings.get(
            "in_app_enabled",
            channel != "push"
        ))
        legacy_push_enabled = bool(settings.get(
            "push_enabled",
            channel == "push"
        ))

        def normalize_metric(metric_name: str) -> dict:
            default_metric = default_settings["metrics"][metric_name]
            metric_settings = metrics.get(metric_name) or {}
            return {
                "threshold": int(metric_settings.get(
                    "threshold",
                    thresholds.get(metric_name, default_metric["threshold"])
                )),
                "in_app_enabled": bool(metric_settings.get(
                    "in_app_enabled",
                    legacy_in_app_enabled
                )),
                "push_enabled": bool(metric_settings.get(
                    "push_enabled",
                    legacy_push_enabled
                ))
            }

        return {
            "enabled": bool(settings.get("enabled", default_settings["enabled"])),
            "metrics": {
                "cpu_percent": normalize_metric("cpu_percent"),
                "memory_percent": normalize_metric("memory_percent"),
                "disk_percent": normalize_metric("disk_percent"),
            }
        }

    @staticmethod
    async def update_notification_settings(
        account_id: str,
        enabled: bool,
        metrics: dict
    ) -> dict:
        db = get_account_database(account_id)
        settings = {
            "enabled": enabled,
            "metrics": metrics
        }
        await db.metadata.update_one(
            {"account_id": account_id},
            {
                "$set": {
                    "notification_settings": settings,
                    "updated_on": datetime.now(UTC)
                }
            }
        )
        return MetadataRepository.normalize_notification_settings(settings)

