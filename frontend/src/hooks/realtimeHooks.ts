import { useEffect } from "react";
import { connectSocket, getSocket } from "../lib/socket";
import { MessageDetail } from "../types/message";

export type TypingEvent = {
  chatId: string;
  typing: boolean;
  userId: string;
  userName: string;
};

/**
 * Keeps the shared socket connected for as long as a signed-in component is
 * mounted. Connecting is idempotent, so every consumer can call it.
 */
export const useRealtimeConnection = (enabled: boolean): void => {
  useEffect(() => {
    if (!enabled) return;
    connectSocket();
  }, [enabled]);
};

/** Subscribe to messages, optionally narrowed to one conversation. */
export const useChatMessages = (
  chatId: string | undefined,
  onMessage: (message: MessageDetail) => void,
  enabled = true
): void => {
  useEffect(() => {
    if (!enabled) return;
    const socket = connectSocket();

    const handler = (message: MessageDetail) => {
      if (chatId && message.chatId !== chatId) return;
      onMessage(message);
    };

    socket.on("chat:message", handler);
    return () => {
      socket.off("chat:message", handler);
    };
  }, [chatId, onMessage, enabled]);
};

/** Subscribe to typing events, optionally narrowed to one conversation. */
export const useTypingEvents = (
  chatId: string | undefined,
  onTyping: (event: TypingEvent) => void,
  enabled = true
): void => {
  useEffect(() => {
    if (!enabled) return;
    const socket = connectSocket();

    const handler = (event: TypingEvent) => {
      if (chatId && event.chatId !== chatId) return;
      onTyping(event);
    };

    socket.on("typing", handler);
    return () => {
      socket.off("typing", handler);
    };
  }, [chatId, onTyping, enabled]);
};

/**
 * Tell the server we are typing. The server stamps the event with the
 * authenticated sender, so no identity travels in this payload.
 */
export const emitTyping = (chatId: string, typing: boolean): void => {
  const socket = getSocket();
  if (socket.connected) socket.emit("typing", { chatId, typing });
};

/** Join a conversation created or accepted after the socket connected. */
export const subscribeToChat = (chatId: string): void => {
  const socket = getSocket();
  if (socket.connected) socket.emit("chat:subscribe", { chatId });
};
