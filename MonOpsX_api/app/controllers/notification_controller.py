from fastapi import APIRouter, Depends, Query, Response, status

from app.dependencies.auth import CurrentUser, require_permission
from app.enums.permissions.notification_permissions import NotificationPermissions
from app.schemas.notification import (
    MarkAllNotificationsResponse,
    NotificationResponse,
    PushTokenRequest
)
from app.services.notification_service import NotificationService


router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=list[NotificationResponse])
async def get_notifications(
    unread: bool | None = Query(default=None),
    type: str | None = Query(default=None),
    severity: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    current_user: CurrentUser = Depends(require_permission(NotificationPermissions.ACCESS.value))
) -> list[NotificationResponse]:
    return await NotificationService.get_all(
        current_user.account_id,
        unread,
        type,
        severity,
        limit
    )


@router.post("/push-token", status_code=status.HTTP_204_NO_CONTENT)
async def save_push_token(
    request: PushTokenRequest,
    current_user: CurrentUser = Depends(require_permission(NotificationPermissions.ACCESS.value))
) -> Response:
    await NotificationService.save_push_token(current_user.account_id, current_user.user_id, request)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/push-token", status_code=status.HTTP_204_NO_CONTENT)
async def delete_push_token(
    request: PushTokenRequest,
    current_user: CurrentUser = Depends(require_permission(NotificationPermissions.ACCESS.value))
) -> Response:
    await NotificationService.delete_push_token(current_user.account_id, current_user.user_id, request)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: str,
    current_user: CurrentUser = Depends(require_permission(NotificationPermissions.UPDATE.value))
) -> NotificationResponse:
    return await NotificationService.mark_read(current_user.account_id, notification_id)


@router.patch("/read-all", response_model=MarkAllNotificationsResponse)
async def mark_all_notifications_read(
    current_user: CurrentUser = Depends(require_permission(NotificationPermissions.UPDATE.value))
) -> MarkAllNotificationsResponse:
    return await NotificationService.mark_all_read(current_user.account_id)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_all_notifications(
    current_user: CurrentUser = Depends(require_permission(NotificationPermissions.UPDATE.value))
) -> None:
    await NotificationService.delete_all(current_user.account_id)


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: str,
    current_user: CurrentUser = Depends(require_permission(NotificationPermissions.UPDATE.value))
) -> None:
    await NotificationService.delete(current_user.account_id, notification_id)
