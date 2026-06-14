from fastapi import APIRouter, Depends, Response, status

from app.dependencies.auth import CurrentUser, require_permission
from app.enums.permissions.roles_permissions import RolesPermissions
from app.schemas.role import CreateRoleRequest, RoleResponse, UpdateRoleRequest
from app.services.role_service import RoleService


router = APIRouter(prefix="/roles", tags=["Roles"])


@router.get("", response_model=list[RoleResponse])
async def get_roles(
    current_user: CurrentUser = Depends(
        require_permission(RolesPermissions.ACCESS.value)
    )
) -> list[RoleResponse]:
    roles = await RoleService.get_all(current_user.account_id)
    return [RoleResponse.model_validate(role) for role in roles]


@router.post("", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    request: CreateRoleRequest,
    current_user: CurrentUser = Depends(
        require_permission(RolesPermissions.CREATE.value)
    )
) -> RoleResponse:
    role = await RoleService.create(current_user.account_id, request)
    return RoleResponse.model_validate(role)


@router.put("/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: str,
    request: UpdateRoleRequest,
    current_user: CurrentUser = Depends(
        require_permission(RolesPermissions.UPDATE.value)
    )
) -> RoleResponse:
    role = await RoleService.update(
        current_user.account_id,
        role_id,
        request
    )
    return RoleResponse.model_validate(role)


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: str,
    current_user: CurrentUser = Depends(
        require_permission(RolesPermissions.DELETE.value)
    )
) -> Response:
    await RoleService.delete(current_user.account_id, role_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
