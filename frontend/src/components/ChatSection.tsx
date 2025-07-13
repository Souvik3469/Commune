import ChatRow from "./ChatRow";
import { FC } from "react";
type ChatSectionProps = {
  title: string;
  chats: Array<{
    name: string;
    message: string;
    time: string;
    avatarSrc: string;
    seen: boolean;
  }>;
  isGroup: boolean;
};
const ChatSection: FC<ChatSectionProps> = ({ title, chats, isGroup }) => (
  <div
    className={`mt-2  overflow-y-scroll no-scrollbar ${
      isGroup ? "h-48" : "h-[55%] sm:h-[300px]"
    }`}
  >
    <div className="text-gray-800 dark:text-gray-100 bg-white dark:bg-black text-xs font-semibold  sticky top-0 left-0 z-10 py-2   w-full">
      {title}
    </div>
    {chats.map((chat, index) => (
      <ChatRow key={index} {...chat} />
    ))}
  </div>
);

export default ChatSection;
