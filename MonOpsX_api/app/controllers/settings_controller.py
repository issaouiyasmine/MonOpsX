from fastapi import APIRouter, Depends

from app.dependencies.auth import CurrentUser, require_permission
from app.enums.permissions.notification_permissions import NotificationPermissions
from app.enums.permissions.settings_permissions import SettingsPermissions
from app.schemas.settings import (
    NotificationSettingsResponse,
    UpdateNotificationSettingsRequest
)
from app.services.settings_service import SettingsService


router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("/notifications", response_model=NotificationSettingsResponse)
async def get_notification_settings(
    current_user: CurrentUser = Depends(require_permission(SettingsPermissions.ACCESS.value))
) -> NotificationSettingsResponse:
    return await SettingsService.get_notification_settings(current_user.account_id)


@router.patch("/notifications", response_model=NotificationSettingsResponse)
async def update_notification_settings(
    request: UpdateNotificationSettingsRequest,
    current_user: CurrentUser = Depends(require_permission(NotificationPermissions.UPDATE.value))
) -> NotificationSettingsResponse:
    return await SettingsService.update_notification_settings(current_user.account_id, request)
