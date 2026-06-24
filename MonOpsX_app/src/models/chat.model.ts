export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  server_id?: string | null;
  created_at: string;
}

export interface ChatHistoryResponse {
  messages: ChatMessage[];
}

export interface ChatReplyResponse {
  user_message: ChatMessage;
  assistant_message: ChatMessage;
}

export interface SendChatMessageRequest {
  message: string;
  server_id?: string;
}
