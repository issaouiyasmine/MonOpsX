from fastapi import APIRouter, Depends, Response, status

from app.dependencies.auth import CurrentUser, require_permission
from app.enums.permissions.users_permissions import UsersPermissions
from app.schemas.user import CreateUserRequest, UpdateUserRequest, UserResponse
from app.services.user_service import UserService


router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=list[UserResponse])
async def get_users(
    current_user: CurrentUser = Depends(
        require_permission(UsersPermissions.ACCESS.value)
    )
) -> list[UserResponse]:
    users = await UserService.get_all(current_user.account_id)
    return [UserResponse.model_validate(user) for user in users]


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    request: CreateUserRequest,
    current_user: CurrentUser = Depends(
        require_permission(UsersPermissions.CREATE.value)
    )
) -> UserResponse:
    user = await UserService.create(current_user.account_id, request)
    return UserResponse.model_validate(user)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    request: UpdateUserRequest,
    current_user: CurrentUser = Depends(
        require_permission(UsersPermissions.UPDATE.value)
    )
) -> UserResponse:
    user = await UserService.update(
        current_user.account_id,
        user_id,
        request
    )
    return UserResponse.model_validate(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    current_user: CurrentUser = Depends(
        require_permission(UsersPermissions.DELETE.value)
    )
) -> Response:
    await UserService.delete(current_user.account_id, user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
