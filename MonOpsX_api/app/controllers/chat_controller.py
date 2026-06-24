from fastapi import APIRouter, Depends, Response, status

from app.dependencies.auth import CurrentUser, get_current_user
from app.schemas.chat import ChatConversationResponse, ChatMessageRequest, ChatReplyResponse
from app.services.chat_service import ChatService


router = APIRouter(prefix="/chat", tags=["Chat"])


@router.get("/history", response_model=ChatConversationResponse)
async def get_chat_history(
    current_user: CurrentUser = Depends(get_current_user)
) -> ChatConversationResponse:
    return await ChatService.get_history(current_user.account_id, current_user.user_id)


@router.post("/messages", response_model=ChatReplyResponse)
async def create_chat_message(
    request: ChatMessageRequest,
    current_user: CurrentUser = Depends(get_current_user)
) -> ChatReplyResponse:
    return await ChatService.create_reply(current_user.account_id, current_user.user_id, request)


@router.delete("/history", status_code=status.HTTP_204_NO_CONTENT)
async def clear_chat_history(
    current_user: CurrentUser = Depends(get_current_user)
) -> Response:
    await ChatService.clear_history(current_user.account_id, current_user.user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
