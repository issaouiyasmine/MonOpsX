from fastapi import APIRouter, status

from app.schemas.account_schema import (
    CreateAccountRequest
)
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    LogoutRequest,
    LogoutResponse,
    RefreshTokenRequest
)
from app.services.auth_service import AuthService


router = APIRouter(tags=["Auth"])


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED
)
async def register(
    request: CreateAccountRequest
) -> AuthResponse:
    response = await AuthService.register(request)
    return AuthResponse.model_validate(response)


@router.post(
    "/login",
    response_model=AuthResponse
)
async def login(request: LoginRequest) -> AuthResponse:
    response = await AuthService.login(request)
    return AuthResponse.model_validate(response)


@router.post(
    "/refresh",
    response_model=AuthResponse
)
async def refresh_token(
    request: RefreshTokenRequest
) -> AuthResponse:
    response = await AuthService.refresh(request.refresh_token)
    return AuthResponse.model_validate(response)


@router.post(
    "/logout",
    response_model=LogoutResponse
)
async def logout(request: LogoutRequest) -> LogoutResponse:
    response = await AuthService.logout(request.refresh_token)
    return LogoutResponse.model_validate(response)
