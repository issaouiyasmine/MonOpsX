from fastapi import APIRouter, Query

from app.services.dashboard_service import DashboardService


router = APIRouter(prefix="/internal", tags=["Internal"])


@router.get("/grafana/servers")
async def grafana_servers() -> list[dict[str, str]]:
    return await DashboardService.get_internal_servers()


@router.get("/grafana/event-types")
async def grafana_event_types() -> list[dict[str, str]]:
    return [
        {"label": event_type, "value": event_type}
        for event_type in DashboardService.EVENT_TYPES
    ]


@router.get("/grafana/metrics")
async def grafana_metrics(
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = None,
    server_id: str | None = None,
    event_type: str = "all"
) -> dict:
    start, end = DashboardService.range_from_period("24h")
    return await DashboardService.get_internal_dashboard(
        DashboardService.parse_datetime(from_, start),
        DashboardService.parse_datetime(to, end),
        server_id,
        event_type
    )
