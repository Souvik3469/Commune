import { FaPhoneAlt, FaVideo } from "react-icons/fa";
import { BsThreeDotsVertical } from "react-icons/bs";
import { ChatPreview } from "../types/chat";
import { useMyDetails } from "../hooks/userHooks";

const ChatBar = ({ chat }: { chat: ChatPreview }) => {
  const { data: user, isLoading: isUserLoading } = useMyDetails();
  const currentUserId = user?.id;

  if (!chat || (!chat.users && !chat.isGroup)) {
    return (
      <div className="p-4 text-gray-500 dark:text-gray-400">
        No user info available
      </div>
    );
  }

  // Determine display name and avatar
  const isGroup = chat.isGroup;
  const displayName = isGroup
    ? chat.name
    : chat.users.find((u) => u.id !== currentUserId)?.name || "Unknown";
  const displayAvatar = isGroup
    ? chat.logo
    : chat.users.find((u) => u.id !== currentUserId)?.profilePic || "";
  if (isUserLoading) {
    return <p>Loading user...</p>;
  }

  console.log("USER", user);
  console.log("USERS", chat.users);

  return (
    <div className="grid grid-cols-12 p-2 bg-white dark:bg-black border-b-[1px] border-gray-300 dark:border-gray-700 sticky top-0 z-10">
      <div className="col-span-9 flex items-center mx-2">
        <div className="relative">
          <img
            src={displayAvatar}
            className="h-12 w-12 rounded-full object-cover"
            alt="avatar"
          />
          {!isGroup && (
            <div className="absolute bottom-0 right-1 h-2 w-2 bg-blue-500 rounded-full" />
          )}
        </div>
        <div className="mx-3">
          <div className="text-sm text-gray-800 dark:text-gray-200">
            {displayName}
          </div>
          {!isGroup && <div className="text-xs text-blue-600">Online</div>}
        </div>
      </div>
      <div className="col-span-3 flex items-center space-x-8 justify-end mx-4">
        <FaPhoneAlt className="text-xl text-gray-400" />
        <FaVideo className="text-xl text-gray-400" />
        <BsThreeDotsVertical className="text-xl text-gray-400" />
      </div>
    </div>
  );
};

export default ChatBar;
