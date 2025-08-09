import { IoSearch } from "react-icons/io5";
import logo from "../assets/logo1.png";
import ChatSection from "./ChatSection";
import { FaPlus } from "react-icons/fa6";
import { FC, useEffect, useMemo, useRef, useState } from "react";
import {
  useAllChats,
  useCreateChat,
  useGroupChats,
  useUpdateChat,
} from "../hooks/chatHooks";
import { useMyDetails, useUserSearch } from "../hooks/userHooks";
import {
  Chat,
  ChatPreview,
  ExtendedChat,
  TransformedChat,
} from "../types/chat";
import { formatDistanceToNow } from "date-fns";
import Ably from "ably";
import type { Message as AblyMessage } from "ably";
import { UserPreview } from "../types/user";

const MAX_MSG_LENGTH = 30;

type AllChatsProps = {
  className?: string;
  setSelectedChat: (chat: ChatPreview) => void;
};

const AllChats: FC<AllChatsProps> = ({ className, setSelectedChat }) => {
  const { data: user, isLoading: UserLoading } = useMyDetails();

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
  const [groupLogo, setGroupLogo] = useState<File | null>(null);
  const [previewLogo, setPreviewLogo] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [updatedChats, setUpdatedChats] = useState<
    Record<string, { content: string; timestamp: string }>
  >({});
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [chatToEdit, setChatToEdit] = useState<Chat | null>(null);
  const [originalUserIds, setOriginalUserIds] = useState<string[]>([]);
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [chatToViewMembers, setChatToViewMembers] =
    useState<ChatPreview | null>(null);

  const ablyRef = useRef<Ably.Realtime | null>(null);

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
  const { data: rawSearchResults = [] } = useUserSearch(searchQuery);
  const searchResults = useMemo(
    () => rawSearchResults.filter((u: UserPreview) => u.id !== user?.id),
    [rawSearchResults, user?.id]
  );

  const handleEditGroupClick = (chat: ChatPreview) => {
    if (!chat.isGroup || chat.adminId !== user?.id) return;
    setGroupName(chat.name || "");
    const ids = chat.users.map((u) => u.id);
    setSelectedUsers(ids);
    setOriginalUserIds(ids);
    setGroupLogo(null);
    setPreviewLogo(chat.logo || null);
    setSearchQuery("");
    setChatToEdit(chat);
    setIsEditingGroup(true);
  };

  const handleViewMembersClick = (chat: ChatPreview) => {
    setChatToViewMembers(chat);
    setShowMembersDialog(true);
  };

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
        name: groupName,
        userIds: selectedUsers,
        logo: groupLogo,
      });
      setGroupName("");
      setSelectedUsers([]);
      setIsCreatingGroup(false);
      setSearchQuery("");
      setGroupLogo(null);
      setPreviewLogo(null);
      setSelectedChat(newGroup);
    } catch (err) {
      console.error("Group creation failed", err);
    }
  };

  const updateChatMutation = useUpdateChat();

  const handleUpdateGroup = async () => {
    if (!chatToEdit) return;
    const prevUserIds = originalUserIds;
    const newUserIds = selectedUsers;
    const addUserIds = newUserIds.filter((id) => !prevUserIds.includes(id));
    const removeUserIds = prevUserIds.filter((id) => !newUserIds.includes(id));
    try {
      const updatedGroup = await updateChatMutation.mutateAsync({
        chatId: chatToEdit.id,
        data: {
          name: groupName,
          logo: groupLogo,
          addUserIds: addUserIds.length ? addUserIds : undefined,
          removeUserIds: removeUserIds.length ? removeUserIds : undefined,
        },
      });
      setGroupName("");
      setSelectedUsers([]);
      setOriginalUserIds([]);
      setIsEditingGroup(false);
      setChatToEdit(null);
      setSearchQuery("");
      setGroupLogo(null);
      setPreviewLogo(null);
      setSelectedChat(updatedGroup);
    } catch (err) {
      console.error("Group update failed", err);
    }
  };

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
          ? chat.logo || "https://www.tenniscall.com/images/chat.jpg"
          : otherUser!.profilePic ||
            "https://static.vecteezy.com/system/resources/thumbnails/009/292/244/small_2x/default-avatar-icon-of-social-media-user-vector.jpg",
        seen: true,
        fullChat: {
          id: chat.id,
          isGroup,
          name: chat.name,
          logo: chat.logo,
          userIds: chat.users.map((u) => u.id),
          users: chat.users,
          adminId: (chat as ExtendedChat).adminId,
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

  if (UserLoading || !user) return null;

  return (
    <div
      className={`w-[30%] h-screen border-r border-gray-300 dark:border-gray-700 flex flex-col ${className}`}
    >
      {/* Logo */}
      <div className="mt-1 mb-2">
        <div className="flex items-center my-2 px-2">
          <img src={logo} className="h-12 w-12" />
          <div className="text-2xl font-bold ml-1 mt-1">
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
      {showMembersDialog && chatToViewMembers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl w-[90%] max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Group Members
              </h2>
              <button
                onClick={() => setShowMembersDialog(false)}
                className="text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <ul className="space-y-2">
              {chatToViewMembers.users.map((u) => (
                <li key={u.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img
                      src={u.profilePic || "/default-avatar.png"}
                      alt={u.name}
                      className="w-8 h-8 rounded-full"
                    />
                    <span className="text-gray-900 dark:text-white">
                      {u.name}
                    </span>
                    {u.id === chatToViewMembers.adminId && (
                      <span className="text-xs text-blue-500">(admin)</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Group Creation Mode */}
      {isCreatingGroup || isEditingGroup ? (
        <div className="flex-1 overflow-y-auto mt-2 px-2">
          <ChatSection
            title={isEditingGroup ? "EDIT GROUP MEMBERS" : "SELECT USERS"}
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

          <div className="mt-5 space-y-2">
            <div className="flex items-center space-x-4">
              {previewLogo ? (
                <img
                  src={previewLogo}
                  className="h-10 w-10 rounded-full object-cover border border-gray-300"
                  alt="Group Logo Preview"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-600">
                  Logo
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setGroupLogo(file);
                    setPreviewLogo(URL.createObjectURL(file));
                  }
                }}
                className="text-sm"
              />
            </div>

            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md p-2 text-sm dark:bg-black dark:text-white"
              placeholder="Enter group name"
            />

            <button
              onClick={isEditingGroup ? handleUpdateGroup : handleCreateGroup}
              className="w-full bg-blue-600 text-white py-2 rounded-md text-sm disabled:opacity-50"
              disabled={selectedUsers.length === 0 || !groupName.trim()}
            >
              {isEditingGroup ? "Save Changes" : "Create Group"}
            </button>

            <button
              onClick={() => {
                setIsCreatingGroup(false);
                setIsEditingGroup(false);
                setGroupName("");
                setSelectedUsers([]);
                setOriginalUserIds([]);
                setSearchQuery("");
                setGroupLogo(null);
                setPreviewLogo(null);
                setChatToEdit(null);
              }}
              className="w-full text-sm text-gray-600 dark:text-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : searchQuery ? (
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
              currentUserId={user?.id}
              onChatClick={(chatId) => {
                const selected = transformedGroups.find((c) => c.id === chatId);
                if (selected) setSelectedChat(selected.fullChat);
              }}
              onEditClick={(chat: ChatPreview) => handleEditGroupClick(chat)}
              onViewMembersClick={handleViewMembersClick}
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
