from fastapi import APIRouter, Depends, Request, status

from app.dependencies.webhook import get_webhook_token
from app.schemas.webhook import ServerMetricsWebhookRequest, ServerMetricsWebhookResponse
from app.services.webhook_service import WebhookService


router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


@router.post(
    "/server-metrics",
    response_model=ServerMetricsWebhookResponse,
    status_code=status.HTTP_202_ACCEPTED
)
async def receive_server_metrics(
    request: Request,
    payload: ServerMetricsWebhookRequest,
    token: str = Depends(get_webhook_token)
) -> ServerMetricsWebhookResponse:
    body = await request.body()
    if len(body) > 256_000:
        from fastapi import HTTPException

        raise HTTPException(status_code=413, detail="Payload webhook trop volumineux")

    token_data = await WebhookService.resolve_token(token)
    return await WebhookService.ingest(token_data, payload)
