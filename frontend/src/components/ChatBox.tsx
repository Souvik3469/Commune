import { FC, useRef } from "react";
import ChatBar from "./ChatBar";
import ChatArea from "./ChatArea";
import MessageBox from "./MessageBox";
import { ChatPreview } from "../types/chat";

type ChatBoxProps = {
  className?: string;
  chat: ChatPreview | null;
};

const ChatBox: FC<ChatBoxProps> = ({ className, chat }) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  };

  if (!chat) {
    return (
      <div
        className={`w-[70%] h-screen flex items-center justify-center ${className}`}
      >
        <p className="text-gray-500 dark:text-gray-400">
          Select a chat to begin
        </p>
      </div>
    );
  }

  return (
    <div className={`text-white w-[70%] h-screen ${className}`}>
      <ChatBar chat={chat} />
      <ChatArea
        chatId={chat.id}
        bottomRef={bottomRef}
        scrollToBottom={scrollToBottom}
      />
      <MessageBox chatId={chat.id} scrollToBottom={scrollToBottom} />
    </div>
  );
};

export default ChatBox;
