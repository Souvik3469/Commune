import { ChatPreview } from "../types/chat";
import ChatRow from "./ChatRow";
import { FC } from "react";

type Chat = {
  name: string;
  message: string;
  time: string;
  avatarSrc: string;
  seen: boolean;
  id: string;
  chatId: string;
  fullChat: ChatPreview; // ✅ add this
};

type ChatSectionProps = {
  title: string;
  chats: Chat[];
  isGroup: boolean;
  onChatClick?: (chatId: string) => void;
  fullHeight?: boolean;
  selectable?: boolean; // ← add this
  onEditClick?: (chat: ChatPreview) => void;
  currentUserId?: string;
  actionButtons?: (chat: ChatPreview) => React.ReactNode;
  onViewMembersClick?: (chat: ChatPreview) => void;
};

const ChatSection: FC<ChatSectionProps> = ({
  title,
  chats,
  isGroup,
  onChatClick,
  fullHeight = false,
  selectable = false,
  onEditClick,
  currentUserId,
  onViewMembersClick,
}) => {
  return (
    <div
      className={`mt-2 overflow-y-auto no-scrollbar ${
        fullHeight ? "max-h-[55vh]" : isGroup ? "h-48" : "h-[55%] sm:h-[300px]"
      }`}
    >
      <div className="text-gray-800 dark:text-gray-100 bg-white dark:bg-black text-xs font-semibold sticky top-0 left-0 z-10 py-2 w-full">
        {title}
      </div>

      {chats.map((chat, index) => (
        <ChatRow
          key={index}
          {...chat}
          chatId={chat.chatId}
          isGroup={isGroup}
          onClick={() => onChatClick?.(chat.id)}
          selectable={selectable}
          onEditClick={onEditClick} // ✅ pass it here
          currentUserId={currentUserId}
          fullChat={chat.fullChat}
          onViewMembersClick={
            onViewMembersClick
              ? () => onViewMembersClick(chat.fullChat)
              : undefined
          }
        />
      ))}
    </div>
  );
};

export default ChatSection;
