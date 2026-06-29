from fastapi import APIRouter, Depends

from app.dependencies.auth import CurrentUser, get_current_user, require_permission
from app.enums.permissions.account_permissions import AccountPermissions
from app.schemas.profile import (
    DeleteAccountRequest,
    ProfileResponse,
    UpdateProfileAccountRequest,
    UpdateProfilePasswordRequest,
    UpdateProfileUserRequest,
)
from app.services.profile_service import ProfileService


router = APIRouter(prefix="/profile", tags=["Profile"])


@router.get("", response_model=ProfileResponse)
async def get_profile(current_user: CurrentUser = Depends(get_current_user)) -> ProfileResponse:
    profile = await ProfileService.get_profile(current_user.account_id, current_user.user_id)
    return ProfileResponse.model_validate(profile)


@router.patch("/user", response_model=ProfileResponse)
async def update_profile_user(
    request: UpdateProfileUserRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> ProfileResponse:
    profile = await ProfileService.update_user(current_user.account_id, current_user.user_id, request)
    return ProfileResponse.model_validate(profile)


@router.patch("/account", response_model=ProfileResponse)
async def update_profile_account(
    request: UpdateProfileAccountRequest,
    current_user: CurrentUser = Depends(require_permission(AccountPermissions.UPDATE.value)),
) -> ProfileResponse:
    profile = await ProfileService.update_account(current_user.account_id, current_user.user_id, request)
    return ProfileResponse.model_validate(profile)


@router.patch("/password", response_model=ProfileResponse)
async def update_profile_password(
    request: UpdateProfilePasswordRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> ProfileResponse:
    profile = await ProfileService.update_password(current_user.account_id, current_user.user_id, request)
    return ProfileResponse.model_validate(profile)


@router.delete("/account", status_code=204)
async def delete_profile_account(
    request: DeleteAccountRequest,
    current_user: CurrentUser = Depends(require_permission(AccountPermissions.DELETE.value)),
) -> None:
    await ProfileService.delete_account(
        current_user.account_id,
        current_user.user_id,
        current_user.is_principal,
        request
    )
