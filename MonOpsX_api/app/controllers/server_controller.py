from fastapi import APIRouter, Depends, Query, status

from app.dependencies.auth import CurrentUser, get_current_user
from app.schemas.server import (
    CreateServerRequest,
    CreatedServerResponse,
    RotatedServerTokenResponse,
    ServerMetricResponse,
    ServerResponse,
    UpdateServerRequest
)
from app.services.server_service import ServerService


router = APIRouter(prefix="/servers", tags=["Servers"])


@router.get("", response_model=list[ServerResponse])
async def get_servers(
    current_user: CurrentUser = Depends(get_current_user)
) -> list[ServerResponse]:
    return await ServerService.get_all(current_user.account_id)


@router.post("", response_model=CreatedServerResponse, status_code=status.HTTP_201_CREATED)
async def create_server(
    request: CreateServerRequest,
    current_user: CurrentUser = Depends(get_current_user)
) -> CreatedServerResponse:
    return await ServerService.create(current_user.account_id, request)


@router.patch("/{server_id}", response_model=ServerResponse)
async def update_server(
    server_id: str,
    request: UpdateServerRequest,
    current_user: CurrentUser = Depends(get_current_user)
) -> ServerResponse:
    return await ServerService.update(current_user.account_id, server_id, request)


@router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_server(
    server_id: str,
    current_user: CurrentUser = Depends(get_current_user)
) -> None:
    await ServerService.delete(current_user.account_id, server_id)


@router.post("/{server_id}/rotate-token", response_model=RotatedServerTokenResponse)
async def rotate_server_token(
    server_id: str,
    current_user: CurrentUser = Depends(get_current_user)
) -> RotatedServerTokenResponse:
    return await ServerService.rotate_token(current_user.account_id, server_id)


@router.get("/{server_id}/metrics", response_model=list[ServerMetricResponse])
async def get_server_metrics(
    server_id: str,
    limit: int = Query(default=100, ge=1, le=1000),
    current_user: CurrentUser = Depends(get_current_user)
) -> list[ServerMetricResponse]:
    return await ServerService.get_metrics(current_user.account_id, server_id, limit)
