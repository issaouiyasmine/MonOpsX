from fastapi import APIRouter, Depends, Query

from app.dependencies.auth import CurrentUser, get_current_user
from app.services.dashboard_service import DashboardService


router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/metrics")
async def get_dashboard_metrics(
    period: str = Query(default="24h"),
    server_id: str | None = Query(default=None),
    event_type: str = Query(default="all"),
    current_user: CurrentUser = Depends(get_current_user)
) -> dict:
    return await DashboardService.get_account_dashboard(
        current_user.account_id,
        period,
        server_id,
        event_type
    )
