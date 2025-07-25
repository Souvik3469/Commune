import { FC, useEffect, useRef, useState } from "react";
import Ably from "ably";
import type { Message as AblyMessage } from "ably";
import { useMyDetails } from "../hooks/userHooks";
import { useMessages } from "../hooks/chatHooks";
import { useQueryClient, InfiniteData } from "@tanstack/react-query";

const MSG_GROUP_TIME = 2 * 60 * 1000;
const TYPING_DELAY = 1000;

export interface Message {
  id: string;
  content: string;
  timestamp: string;
  senderId: string;
  chatId: string;
  sender: {
    name: string;
    profilePic: string | null;
  };
}

type ChatAreaProps = {
  chatId: string;
  bottomRef: React.RefObject<HTMLDivElement>;
  scrollToBottom: () => void;
};

const ChatArea: FC<ChatAreaProps> = ({ chatId, bottomRef, scrollToBottom }) => {
  const { data: user, isLoading: isUserLoading } = useMyDetails();
  const queryClient = useQueryClient();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const isInitialLoadRef = useRef(true);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isTyping, setIsTyping] = useState(false);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useMessages(chatId);

  const messages = data?.pages.flatMap((page) => page.messages).reverse() || [];

  useEffect(() => {
    if (messages.length > 0 && !isFetchingNextPage) {
      scrollToBottom();
    }
  }, [messages.length, isFetchingNextPage, chatId]);

  // Scroll to bottom only once on initial load
  useEffect(() => {
    if (isInitialLoadRef.current && messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
      isInitialLoadRef.current = false;
    }
  }, [messages.length, chatId]);

  // Infinite scroll fetch
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (container.scrollTop < 50 && hasNextPage && !isFetchingNextPage) {
        const prevHeight = container.scrollHeight;

        fetchNextPage().then(() => {
          requestAnimationFrame(() => {
            const newHeight = container.scrollHeight;
            container.scrollTop = newHeight - prevHeight;
          });
        });
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // Subscribe to Ably events
  useEffect(() => {
    if (!chatId || !user?.id) return;

    const ably = new Ably.Realtime(import.meta.env.VITE_ABLY_API_KEY!);
    const channel = ably.channels.get(`chat-${chatId}`);

    const onNewMessage = (msg: AblyMessage) => {
      const newMessage = msg.data as Message;

      queryClient.setQueryData<
        InfiniteData<{ messages: Message[]; nextCursor: string | null }>
      >(["messages", chatId], (oldData) => {
        if (!oldData) return oldData;

        const pages = [...oldData.pages];
        const lastPageIndex = pages.length - 1;
        const lastPage = pages[lastPageIndex];

        const alreadyExists = lastPage.messages.some(
          (m) => m.id === newMessage.id
        );
        if (alreadyExists) return oldData;

        const updatedLastPage = {
          ...lastPage,
          messages: [...lastPage.messages, newMessage],
        };

        pages[lastPageIndex] = updatedLastPage;
        return { ...oldData, pages };
      });

      const container = containerRef.current;
      if (
        container &&
        container.scrollHeight - container.scrollTop - container.clientHeight <
          100
      ) {
        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        });
      }
    };

    const onTyping = (msg: AblyMessage) => {
      const { typing, userId: senderId } = msg.data || {};

      if (!senderId || senderId === user.id) return;

      if (typing) {
        setIsTyping(true);
        scrollToBottom();
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        typingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false);
        }, TYPING_DELAY); // 👈 Extend duration after last "typing" signal
      } else {
        setIsTyping(false); // 👈 Respond immediately to "typing: false"
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
      }
    };

    channel.subscribe("message", onNewMessage);
    channel.subscribe("typing", onTyping);

    return () => {
      channel.unsubscribe("message", onNewMessage);
      channel.unsubscribe("typing", onTyping);
      ably.close();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [chatId, user?.id, queryClient, bottomRef]);

  useEffect(() => {
    isInitialLoadRef.current = true;
  }, [chatId]);

  if (isUserLoading) {
    return <p>Loading user...</p>;
  }

  if (isLoading) {
    return (
      <div className="h-[82%] flex items-center justify-center text-gray-500 dark:text-gray-400">
        Loading messages...
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="text-white bg-gray-100 dark:bg-black h-[82%] flex flex-col px-2 overflow-y-scroll no-scrollbar"
    >
      {isFetchingNextPage && (
        <div className="text-center text-sm text-gray-500 my-2">
          Loading more...
        </div>
      )}

      {messages.map((msg, index) => {
        const isOwn = msg.senderId === user.id;
        const prevMsg = messages[index - 1];
        const showHeader =
          !prevMsg ||
          prevMsg.senderId !== msg.senderId ||
          new Date(msg.timestamp).getTime() -
            new Date(prevMsg.timestamp).getTime() >
            MSG_GROUP_TIME;

        return (
          <div
            key={msg.id}
            className={`flex items-center mx-2 my-1 ${
              isOwn ? "self-end flex-row-reverse" : "self-start flex-row"
            }`}
          >
            <div>
              <img
                src={msg?.sender?.profilePic || "https://i.pravatar.cc/150"}
                alt={`${msg?.sender?.name} avatar`}
                className={`h-8 w-8 rounded-full mx-2 ${
                  showHeader ? "" : "invisible"
                }`}
              />
            </div>
            <div>
              {showHeader && (
                <div
                  className={`flex items-center ${
                    isOwn ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  <div className="text-xs sm:text-sm text-gray-800 dark:text-gray-300 mx-2">
                    {isOwn ? "You" : msg?.sender?.name}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mx-3">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              )}

              <div
                className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
              >
                <div>
                  <div
                    className={`rounded-lg text-sm sm:text-base ${
                      showHeader ? "my-[3px]" : "my-[0px]"
                    } p-2 self-end inline-block max-w-60 sm:max-w-80 ${
                      isOwn
                        ? "bg-[#00A3FF] text-white"
                        : "bg-white dark:bg-[#292929] text-black dark:text-white"
                    }`}
                  >
                    {msg.content}
                  </div>
                  {showHeader && (
                    <div
                      className={`flex ${
                        isOwn ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div className="text-xs text-gray-500 dark:text-gray-400 mx-1">
                        Seen
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {isTyping && (
        <div className="text-sm text-gray-500 dark:text-gray-400 px-4 py-2">
          Typing...
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};

export default ChatArea;
