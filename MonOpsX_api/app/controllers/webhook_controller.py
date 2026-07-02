import logging

from fastapi import APIRouter, Depends, Request, status
from fastapi import HTTPException

from app.dependencies.webhook import get_webhook_token
from app.schemas.webhook import ServerMetricsWebhookRequest, ServerMetricsWebhookResponse
from app.services.webhook_service import WebhookService


router = APIRouter(prefix="/webhooks", tags=["Webhooks"])
logger = logging.getLogger(__name__)


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
        raise HTTPException(status_code=413, detail="Payload webhook trop volumineux")

    try:
        token_data = await WebhookService.resolve_token(token)
        return await WebhookService.ingest(token_data, payload)
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Unhandled server metrics webhook error: %s", error)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne pendant l'ingestion des metriques"
        ) from error
