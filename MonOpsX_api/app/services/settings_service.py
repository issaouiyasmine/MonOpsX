from app.repositories.accounts.account_metadata_repository import MetadataRepository
from app.schemas.settings import (
    NotificationSettingsResponse,
    UpdateNotificationSettingsRequest
)


class SettingsService:
    @staticmethod
    async def get_notification_settings(account_id: str) -> NotificationSettingsResponse:
        settings = await MetadataRepository.get_notification_settings(account_id)
        return NotificationSettingsResponse(**settings)

    @staticmethod
    async def update_notification_settings(
        account_id: str,
        request: UpdateNotificationSettingsRequest
    ) -> NotificationSettingsResponse:
        settings = await MetadataRepository.update_notification_settings(
            account_id,
            request.enabled,
            request.metrics.model_dump()
        )
        return NotificationSettingsResponse(**settings)
