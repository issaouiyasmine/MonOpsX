from dataclasses import dataclass
from datetime import datetime

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from app.core.config import get_settings
from app.repositories.accounts.role_repository import RoleRepository
from app.repositories.accounts.user_repository import UserRepository
from app.repositories.global_repo.session_repository import SessionRepository
from app.repositories.global_repo.users_repository import UsersRepository
from app.utils.permissions import PermissionHelper


settings = get_settings()
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/swagger-token",
    scheme_name="MonOpsX login",
    description="Use your MonOpsX email as the username."
)


@dataclass
class CurrentUser:
    user_id: str
    account_id: str
    role_id: str
    permissions: list[int]
    is_principal: bool


async def get_current_user(
    access_token: str = Depends(oauth2_scheme)
) -> CurrentUser:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired access token",
        headers={"WWW-Authenticate": "Bearer"}
    )

    try:
        payload = jwt.decode(
            access_token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        user_id = payload.get("user_id")
        account_id = payload.get("account_id")
        session_id = payload.get("session_id")
        if not user_id or not account_id or not session_id:
            raise unauthorized
    except JWTError as error:
        raise unauthorized from error

    session = await SessionRepository.find_by_id(session_id)
    global_user = await UsersRepository.find_by_id(user_id)
    local_user = await UserRepository.find_by_id(account_id, user_id)

    if (
        session is None
        or session.user_id != user_id
        or session.expires_at <= datetime.utcnow()
        or global_user is None
        or global_user.get("account_id") != account_id
        or local_user is None
        or not global_user.get("is_active", False)
        or not local_user.is_active
    ):
        raise unauthorized

    role = await RoleRepository.find_by_id(account_id, str(local_user.role_id))
    if role is None:
        raise unauthorized

    permissions = role.permissions
    if local_user.is_principal or role.is_default or role.normalized_name == "ADMIN":
        permissions = sorted(set(permissions + PermissionHelper.getall_permissions()))

    return CurrentUser(
        user_id=user_id,
        account_id=account_id,
        role_id=str(role.id),
        permissions=permissions,
        is_principal=local_user.is_principal
    )


def require_permission(permission: int):
    async def dependency(
        current_user: CurrentUser = Depends(get_current_user)
    ) -> CurrentUser:
        if permission not in current_user.permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action"
            )
        return current_user

    return dependency
