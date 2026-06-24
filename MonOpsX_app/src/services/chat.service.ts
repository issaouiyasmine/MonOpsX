import type { ChatHistoryResponse, ChatReplyResponse, SendChatMessageRequest } from "@/models/chat.model";

import { api } from "./api.service";

export const ChatService = {
  async getHistory(): Promise<ChatHistoryResponse> {
    const { data } = await api.get<ChatHistoryResponse>("/chat/history");
    return data;
  },

  async sendMessage(payload: SendChatMessageRequest): Promise<ChatReplyResponse> {
    const { data } = await api.post<ChatReplyResponse>("/chat/messages", payload);
    return data;
  },

  async clearHistory(): Promise<void> {
    await api.delete("/chat/history");
  },
};
