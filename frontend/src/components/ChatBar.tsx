import { useMemo } from "react";
import { BsThreeDotsVertical } from "react-icons/bs";
import { ChatPreview } from "../types/chat";
import { useMyDetails } from "../hooks/userHooks";
import { CallButtons } from "./CallButtons";

const ChatBar = ({ chat }: { chat: ChatPreview }) => {
  const { data: user } = useMyDetails();
  const currentUserId = user?.id;
  const isGroup = chat.isGroup;

  const otherUser = useMemo(
    () => chat?.users?.find((u) => u.id !== currentUserId),
    [chat?.users, currentUserId]
  );
  const displayName = isGroup ? chat.name : otherUser?.name || "Unknown";
  const displayAvatar = isGroup ? chat.logo : otherUser?.profilePic || "";

  return (
    <div className="grid grid-cols-12 p-2 bg-white dark:bg-black border-b border-gray-300 dark:border-gray-700 sticky top-0 z-10">
      <div className="col-span-9 flex items-center mx-2">
        <img
          src={displayAvatar}
          className="h-12 w-12 rounded-full object-cover"
          alt="avatar"
        />
        <div className="mx-3">
          <div className="text-sm text-gray-800 dark:text-gray-200">
            {displayName}
          </div>
          {!isGroup && <div className="text-xs text-blue-600">Online</div>}
        </div>
      </div>

      <div className="col-span-3 flex items-center justify-end">
        <CallButtons />
        <BsThreeDotsVertical className="text-xl text-gray-400 ml-6" />
      </div>
    </div>
  );
};

export default ChatBar;
