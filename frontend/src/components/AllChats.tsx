import { IoSearch } from "react-icons/io5";
import logo from "../assets/logo1.png";
import ChatSection from "./ChatSection";
import { FaPlus } from "react-icons/fa6";
import { FC, useEffect, useMemo, useRef, useState } from "react";
import { useAllChats, useCreateChat, useGroupChats } from "../hooks/chatHooks"; // <-- using dynamic hooks
import { useMyDetails, useUserSearch } from "../hooks/userHooks";
import { ChatPreview } from "../types/chat";
import { formatDistanceToNow } from "date-fns";
import Ably from "ably";
import type { Message as AblyMessage } from "ably";

const MAX_MSG_LENGTH = 30;

type AllChatsProps = {
  className?: string;
  setSelectedChat: (chat: ChatPreview) => void;
};

export type UserPreview = {
  id: string;
  name: string;
  email: string;
  profilePic: string;
};

interface Message {
  content: string;
  timestamp: string;
  senderId: string;
}

interface Chat {
  id: string;
  name?: string;
  logo?: string;
  users: UserPreview[];
  messages?: Message[];
}

type TransformedChat = {
  id: string;
  chatId: string;
  name: string;
  message: string;
  time: string;
  avatarSrc: string;
  seen: boolean;
  fullChat: ChatPreview;
};

const AllChats: FC<AllChatsProps> = ({ className, setSelectedChat }) => {
  const { data: user } = useMyDetails();

  const {
    data: oneToOneChats = [],
    isLoading: loadingOneToOne,
    isError: isErrorOneToOne,
  } = useAllChats();
  const {
    data: groupChats = [],
    isLoading: loadingGroups,
    isError: isErrorGroups,
  } = useGroupChats();

  const [searchQuery, setSearchQuery] = useState("");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  // ✅ updatedChats now stores content & timestamp
  const [updatedChats, setUpdatedChats] = useState<
    Record<string, { content: string; timestamp: string }>
  >({});

  const ablyRef = useRef<Ably.Realtime | null>(null);

  // ✅ Subscribe to Ably for real-time updates
  useEffect(() => {
    ablyRef.current = new Ably.Realtime({
      key: import.meta.env.VITE_ABLY_API_KEY!,
      echoMessages: true,
    });

    const ably = ablyRef.current;
    const allChats = [...oneToOneChats, ...groupChats];

    allChats.forEach((chat) => {
      const channel = ably.channels.get(`chat-${chat.id}`);

      channel.subscribe("new-message", (message: AblyMessage) => {
        const data = message.data;
        if (data?.content && data?.createdAt) {
          setUpdatedChats((prev) => ({
            ...prev,
            [chat.id]: {
              content: data.content,
              timestamp: data.createdAt,
            },
          }));
        }
      });
    });

    return () => {
      allChats.forEach((chat) => {
        const channel = ably.channels.get(`chat-${chat.id}`);
        channel.unsubscribe();
        channel.detach();
      });
      ably.close();
    };
  }, [oneToOneChats, groupChats]);

  const createChatMutation = useCreateChat();
  const { data: searchResults = [] } = useUserSearch(searchQuery);

  const handleCreateChat = async (userId: string) => {
    try {
      const newChat = await createChatMutation.mutateAsync({
        isGroup: false,
        userIds: [userId],
      });
      setSearchQuery("");
      setSelectedChat(newChat);
    } catch (err) {
      console.error("Chat creation failed", err);
    }
  };

  const handleToggleUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) return;

    try {
      const newGroup = await createChatMutation.mutateAsync({
        isGroup: true,
        userIds: selectedUsers,
        name: groupName,
      });
      setGroupName("");
      setSelectedUsers([]);
      setIsCreatingGroup(false);
      setSearchQuery("");
      setSelectedChat(newGroup);
    } catch (err) {
      console.error("Group creation failed", err);
    }
  };

  // ✅ Transform chats using updated content & timestamp
  const transformChats = (
    chats: Chat[],
    isGroup: boolean,
    userId: string
  ): TransformedChat[] => {
    const transformed: (TransformedChat | null)[] = chats.map((chat) => {
      const latestMsg = chat.messages?.[0];
      const updated = updatedChats[chat.id];

      const time = updated?.timestamp
        ? formatDistanceToNow(new Date(updated.timestamp), {
            addSuffix: true,
          })
        : latestMsg
        ? formatDistanceToNow(new Date(latestMsg.timestamp), {
            addSuffix: true,
          })
        : "";

      const otherUser = !isGroup
        ? chat.users.find((u: UserPreview) => u.id !== userId)
        : null;

      if (!isGroup && !otherUser) return null;

      const rawMessage = updated?.content || latestMsg?.content || "";
      const croppedMessage =
        rawMessage.length > MAX_MSG_LENGTH
          ? rawMessage.slice(0, MAX_MSG_LENGTH) + "..."
          : rawMessage;

      return {
        id: isGroup ? chat.id : otherUser!.id,
        chatId: chat.id,
        name: isGroup
          ? chat.name || "Unnamed Group"
          : otherUser!.name || "Unknown User",
        message: croppedMessage,
        time,
        avatarSrc: isGroup
          ? chat.logo || "https://i.pravatar.cc/40?img=group"
          : otherUser!.profilePic || "https://i.pravatar.cc/40",
        seen: true,
        fullChat: {
          id: chat.id,
          isGroup,
          name: chat.name,
          logo: chat.logo,
          userIds: chat.users.map((u) => u.id),
          users: chat.users,
        },
      };
    });

    return transformed.filter((chat): chat is TransformedChat => chat !== null);
  };

  const transformedGroups = useMemo(
    () => transformChats(groupChats, true, user?.id),
    [groupChats, user?.id, updatedChats]
  );

  const transformedOneToOne = useMemo(
    () => transformChats(oneToOneChats, false, user?.id),
    [oneToOneChats, user?.id, updatedChats]
  );

  console.log("TRANSFORM", transformedOneToOne);

  return (
    <div
      className={`w-[30%] h-screen border-r border-gray-300 dark:border-gray-700 flex flex-col ${className}`}
    >
      {/* Logo */}
      <div className="mt-1 mb-2">
        <div className="flex items-center my-2 px-2">
          <img src={logo} className="h-12 w-12" />
          <div className="text-xl font-bold ml-2">
            <span className="text-blue-600 dark:text-blue-400">Com</span>
            <span className="text-blue-300 dark:text-white">mune</span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center relative z-20 px-2">
        <div className="relative w-[80%]">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border border-gray-300 dark:border-gray-700 dark:bg-black rounded-md text-gray-800 dark:text-gray-300 text-sm p-2 pl-8 w-full"
            placeholder={
              isCreatingGroup
                ? "Search users to add..."
                : "Search messages and people"
            }
          />
          <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400">
            <IoSearch className="text-lg" />
          </span>
        </div>
        <button
          className="bg-[#00A3FF] mx-2 p-2 rounded-lg"
          onClick={() => {
            setIsCreatingGroup(true);
            setSearchQuery("");
            setSelectedUsers([]);
            setGroupName("");
          }}
        >
          <FaPlus className="text-white text-xl" />
        </button>
      </div>

      {/* Group Creation Mode */}
      {isCreatingGroup ? (
        <div className="flex-1 overflow-y-auto mt-2 px-2">
          <ChatSection
            title="SELECT USERS"
            isGroup={false}
            fullHeight
            chats={searchResults.map((user: UserPreview) => ({
              id: user.id,
              name: user.name,
              message: user.email || "Tap to select",
              time: "",
              avatarSrc: user.profilePic,
              seen: selectedUsers.includes(user.id),
            }))}
            onChatClick={handleToggleUser}
            selectable={true}
          />

          <div className="mt-5">
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md p-2 text-sm dark:bg-black dark:text-white"
              placeholder="Enter group name"
            />
            <button
              onClick={handleCreateGroup}
              className="w-full mt-2 bg-blue-600 text-white py-2 rounded-md text-sm disabled:opacity-50"
              disabled={selectedUsers.length === 0 || !groupName.trim()}
            >
              Create Group
            </button>
            <button
              onClick={() => {
                setIsCreatingGroup(false);
                setGroupName("");
                setSelectedUsers([]);
                setSearchQuery("");
              }}
              className="w-full mt-1 text-sm text-gray-600 dark:text-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : searchQuery ? (
        // Search Mode
        <div className="flex-1 overflow-y-auto mt-2">
          {searchResults.length > 0 ? (
            <ChatSection
              title="SEARCH RESULTS"
              isGroup={false}
              fullHeight
              chats={searchResults.map((user: UserPreview) => ({
                id: user.id,
                name: user.name,
                message: user.email || "Tap to start chat",
                time: "",
                avatarSrc: user.profilePic,
                seen: true,
              }))}
              onChatClick={handleCreateChat}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
              No results found.
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Group Chats */}
          <div className="relative">
            <ChatSection
              title="GROUP CHATS"
              chats={transformedGroups}
              isGroup={true}
              onChatClick={(chatId) => {
                const selected = transformedGroups.find((c) => c.id === chatId);
                if (selected) setSelectedChat(selected.fullChat); // ✅ No type error now
              }}
            />
            {loadingGroups && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-sm text-gray-500">Loading group chats...</p>
              </div>
            )}
            {isErrorGroups && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-sm text-red-500">
                  Error loading group chats
                </p>
              </div>
            )}
            {!loadingGroups &&
              !isErrorGroups &&
              transformedGroups.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-sm text-gray-400">No group chats yet.</p>
                </div>
              )}
          </div>

          {/* One-to-One Chats */}
          <div className="relative">
            <ChatSection
              title="ALL CHATS"
              chats={transformedOneToOne}
              isGroup={false}
              onChatClick={(id) => handleCreateChat(id)}
            />
            {loadingOneToOne && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-sm text-gray-500">Loading chats...</p>
              </div>
            )}
            {isErrorOneToOne && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-sm text-red-500">Error loading chats</p>
              </div>
            )}
            {!loadingOneToOne &&
              !isErrorOneToOne &&
              transformedOneToOne.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-sm text-gray-400">No chats found.</p>
                </div>
              )}
          </div>
        </>
      )}
    </div>
  );
};

export default AllChats;
