from datetime import datetime, timedelta
from secrets import token_urlsafe

from bson import ObjectId
from fastapi import HTTPException, status

from app.core.config import get_settings
from app.models.global_models.session_model import SessionModel
from app.repositories.accounts.user_repository import UserRepository
from app.repositories.accounts.role_repository import RoleRepository
from app.repositories.global_repo.session_repository import SessionRepository
from app.repositories.global_repo.users_repository import UsersRepository
from app.schemas.account_schema import CreateAccountRequest
from app.schemas.auth import LoginRequest
from app.services.account_service import AccountService
from app.utils.jwt import create_access_token
from app.utils.password import verify_password


settings = get_settings()


class AuthService:
    @staticmethod
    async def register(request: CreateAccountRequest) -> dict:
        account = await AccountService.create_account(request)

        try:
            return await AuthService._create_authenticated_session(
                user_id=account["user_id"],
                account_id=account["account_id"],
                email=account["email"]
            )
        except Exception:
            await AccountService.rollback_account_creation(
                account_id=account["account_id"],
                user_id=account["user_id"]
            )
            raise

    @staticmethod
    async def login(request: LoginRequest) -> dict:
        user_data = await UsersRepository.find_by_email(request.email)

        password_hash = (
            user_data.get("database_hash_password")
            if user_data
            else None
        )

        if (
            user_data is None
            or not password_hash
            or not verify_password(request.password, password_hash)
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )

        if (
            not user_data.get("is_active", True)
            and not user_data.get("is_first_login", False)
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is inactive"
            )

        if user_data.get("is_locked", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is locked"
            )

        user_id = str(user_data["_id"])
        account_id = user_data["account_id"]

        local_user = await UserRepository.find_by_id(account_id, user_id)
        if local_user is None:
            raise HTTPException(status_code=401, detail="User is unavailable")

        if user_data.get("is_first_login", False):
            await UsersRepository.activate(user_id)
            await UserRepository.activate(account_id, user_id)
        elif not local_user.is_active:
            raise HTTPException(status_code=403, detail="User is inactive")

        await UserRepository.update_last_login(
            account_id=account_id,
            user_id=user_id
        )

        return await AuthService._create_authenticated_session(
            user_id=user_id,
            account_id=account_id,
            email=user_data["email"]
        )

    @staticmethod
    async def refresh(refresh_token: str) -> dict:
        session = await SessionRepository.find_by_refresh_token(
            refresh_token
        )

        if session is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )

        if session.expires_at <= datetime.utcnow():
            await SessionRepository.delete_by_id(session.id)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token has expired"
            )

        user_data = await UsersRepository.find_by_id(session.user_id)

        if user_data is None or not user_data.get("is_active", True):
            await SessionRepository.delete_by_id(session.id)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User is unavailable"
            )

        new_refresh_token = token_urlsafe(48)
        expires_at = AuthService._refresh_expiration()

        authorization = await AuthService._load_authorization(
            account_id=user_data["account_id"],
            user_id=session.user_id
        )
        response = AuthService._build_auth_response(
            user_id=session.user_id,
            account_id=user_data["account_id"],
            email=user_data["email"],
            session_id=session.id,
            refresh_token=new_refresh_token,
            **authorization
        )

        await SessionRepository.rotate_refresh_token(
            session_id=session.id,
            refresh_token=new_refresh_token,
            expires_at=expires_at
        )

        return response

    @staticmethod
    async def logout(refresh_token: str) -> dict:
        await SessionRepository.delete_by_refresh_token(refresh_token)
        return {"message": "Logout successful"}

    @staticmethod
    async def _create_authenticated_session(
        user_id: str,
        account_id: str,
        email: str
    ) -> dict:
        session_id = str(ObjectId())
        refresh_token = token_urlsafe(48)

        session = SessionModel(
            _id=session_id,
            user_id=user_id,
            refresh_token=refresh_token,
            expires_at=AuthService._refresh_expiration()
        )

        authorization = await AuthService._load_authorization(
            account_id=account_id,
            user_id=user_id
        )
        response = AuthService._build_auth_response(
            user_id=user_id,
            account_id=account_id,
            email=email,
            session_id=session_id,
            refresh_token=refresh_token,
            **authorization
        )

        await SessionRepository.create(session)

        return response

    @staticmethod
    def _build_auth_response(
        user_id: str,
        account_id: str,
        email: str,
        session_id: str,
        refresh_token: str,
        role_id: str,
        permissions: list[int],
        is_principal: bool
    ) -> dict:
        access_token = create_access_token({
            "sub": user_id,
            "user_id": user_id,
            "account_id": account_id,
            "session_id": session_id,
            "email": email,
            "role_id": role_id,
            "permissions": permissions,
            "is_principal": is_principal
        })

        return {
            "user_id": user_id,
            "account_id": account_id,
            "email": email,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "role_id": role_id,
            "permissions": permissions,
            "is_principal": is_principal,
            "token_type": "bearer"
        }

    @staticmethod
    async def _load_authorization(
        account_id: str,
        user_id: str
    ) -> dict:
        user = await UserRepository.find_by_id(account_id, user_id)
        if user is None or not user.is_active:
            raise HTTPException(status_code=401, detail="User is unavailable")

        role = await RoleRepository.find_by_id(account_id, str(user.role_id))
        if role is None:
            raise HTTPException(status_code=401, detail="Role is unavailable")

        return {
            "role_id": str(role.id),
            "permissions": role.permissions,
            "is_principal": user.is_principal
        }

    @staticmethod
    def _refresh_expiration() -> datetime:
        return datetime.utcnow() + timedelta(
            days=settings.REFRESH_TOKEN_EXPIRE_DAYS
        )
