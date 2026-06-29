import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { colors, fonts, radii, spacing, typography } from "@/constants/theme";
import type { ChatMessage } from "@/models/chat.model";
import { ChatService } from "@/services/chat.service";

interface ChatWidgetProps {
  serverId?: string;
  serverLabel?: string;
}

export function ChatWidget({ serverId, serverLabel }: ChatWidgetProps) {
  const { width } = useWindowDimensions();
  const compact = width < 700;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    if (!open) return;

    let mounted = true;

    async function loadHistory() {
      setLoadingHistory(true);
      setError(null);
      try {
        const history = await ChatService.getHistory();
        if (mounted) setMessages(history.messages);
      } catch {
        if (mounted) setError("Impossible de charger l'historique du chat.");
      } finally {
        if (mounted) setLoadingHistory(false);
      }
    }

    loadHistory();
    return () => {
      mounted = false;
    };
  }, [open]);

  async function send() {
    const message = draft.trim();
    if (!message || sending) return;

    setDraft("");
    setSending(true);
    setError(null);

    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: message,
      server_id: serverId,
      created_at: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);

    try {
      const response = await ChatService.sendMessage({
        message,
        ...(serverId ? { server_id: serverId } : {}),
      });
      setMessages((current) => [
        ...current.filter((item) => item.id !== optimistic.id),
        response.user_message,
        response.assistant_message,
      ]);
    } catch {
      setMessages((current) => current.filter((item) => item.id !== optimistic.id));
      setDraft(message);
      setError("L'assistant est indisponible. Vérifiez l'API/Ollama puis réessayez.");
    } finally {
      setSending(false);
    }
  }

  async function clear() {
    setError(null);
    try {
      await ChatService.clearHistory();
      setMessages([]);
    } catch {
      setError("Impossible d'effacer l'historique du chat.");
    }
  }

  return (
    <View pointerEvents="box-none" style={styles.host}>
      {open && (
        <View style={[styles.panel, compact && styles.panelCompact]}>
          <View style={styles.header}>
            <View style={styles.titleWrap}>
              <Text style={styles.title}>MonOpsX Assistant</Text>
              <Text style={styles.context} numberOfLines={1}>
                {serverId ? `Serveur : ${serverLabel || serverId}` : "Contexte global des serveurs"}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <Pressable accessibilityLabel="Effacer l historique" style={styles.iconButton} onPress={clear}>
                <Ionicons name="trash-outline" size={20} color={colors.muted} />
              </Pressable>
              <Pressable accessibilityLabel="Fermer l assistant" style={styles.iconButton} onPress={() => setOpen(false)}>
                <Ionicons name="close" size={20} color={colors.muted} />
              </Pressable>
            </View>
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.messages}
            contentContainerStyle={styles.messagesInner}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {loadingHistory && (
              <View style={styles.emptyState}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.emptyText}>{"Chargement de l'historique"}</Text>
              </View>
            )}

            {!loadingHistory && messages.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="sparkles-outline" size={26} color={colors.primary} />
                <Text style={styles.emptyText}>{"Demandez un récapitulatif, une analyse d'incident ou une prévision d'état."}</Text>
              </View>
            )}

            {messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.messageBubble,
                  message.role === "user" ? styles.userBubble : styles.assistantBubble,
                ]}
              >
                <Text style={styles.messageRole}>{message.role === "user" ? "Vous" : "Assistant"}</Text>
                <Text style={styles.messageText}>{message.content}</Text>
              </View>
            ))}

            {sending && (
              <View style={[styles.messageBubble, styles.assistantBubble]}>
                <ActivityIndicator color={colors.primary} size="small" />
              </View>
            )}
          </ScrollView>

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.inputRow}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Posez une question sur les serveurs ou les métriques..."
              placeholderTextColor={colors.muted}
              style={styles.input}
              multiline
              editable={!sending}
            />
            <Pressable accessibilityLabel="Envoyer" disabled={sending} style={[styles.iconButton, sending && styles.disabled]} onPress={send}>
              <Ionicons name="send" size={20} color={colors.text} />
            </Pressable>
          </View>
        </View>
      )}

      {!open && (
        <Pressable accessibilityLabel="Ouvrir l assistant" style={styles.floatingButton} onPress={() => setOpen(true)}>
          <Ionicons name="chatbubbles-outline" size={22} color={colors.text} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg,
    zIndex: 20,
  },
  panel: {
    width: 380,
    height: 560,
    borderRadius: radii.medium,
    overflow: "hidden",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  panelCompact: {
    width: 330,
    maxWidth: "100%",
    height: 520,
  },
  header: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.sidebar,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: typography.bodyLarge,
  },
  context: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.caption,
  },
  headerActions: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  iconButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.medium,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  floatingButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.medium,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  disabled: {
    opacity: 0.5,
  },
  messages: {
    flex: 1,
  },
  messagesInner: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  emptyState: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  emptyText: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    textAlign: "center",
  },
  messageBubble: {
    gap: spacing.xs,
    borderRadius: radii.medium,
    padding: spacing.sm,
    borderWidth: 1,
  },
  userBubble: {
    marginLeft: spacing.xl,
    backgroundColor: "rgba(14,165,255,0.13)",
    borderColor: "rgba(14,165,255,0.3)",
  },
  assistantBubble: {
    marginRight: spacing.xl,
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  messageRole: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: typography.caption,
  },
  messageText: {
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    lineHeight: 20,
  },
  error: {
    color: colors.danger,
    fontFamily: fonts.medium,
    fontSize: typography.caption,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    maxHeight: 96,
    minHeight: 42,
    borderRadius: radii.medium,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: fonts.regular,
    fontSize: typography.body,
  },
});
