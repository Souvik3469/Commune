import { FC, useState, useRef, useEffect, useCallback } from "react";
import { Check, MoreVertical, Trash2 } from "lucide-react";
import { useDeleteChat } from "../hooks/chatHooks";
import { toast } from "react-hot-toast";
import { AxiosError } from "axios";
import ConfirmDialog from "./ConfirmDialog";
import { useMyDetails } from "../hooks/userHooks";
import { ChatPreview } from "../types/chat";
import TypingIndicator from "./TypingIndicator";
import { useTypingEvents, type TypingEvent } from "../hooks/realtimeHooks";

const TYPING_DELAY = 1000;

type ChatRowProps = {
  id: string;
  chatId: string;
  name: string;
  message: string;
  time: string;
  avatarSrc: string;
  seen: boolean;
  onClick?: () => void;
  selectable?: boolean;
  isGroup?: boolean;
  onEditClick?: (chat: ChatPreview) => void;
  currentUserId?: string;
  fullChat?: ChatPreview;
  onViewMembersClick?: (chat: ChatPreview) => void;
};

const ChatRow: FC<ChatRowProps> = ({
  chatId,
  name,
  message,
  time,
  avatarSrc,
  seen,
  onClick,
  selectable = false,
  isGroup = false,
  onEditClick,
  currentUserId,
  fullChat,
  onViewMembersClick,
}) => {
  const { data: user, isLoading: isUserLoading } = useMyDetails();
  const { mutate: deleteChat } = useDeleteChat();
  const [showMenu, setShowMenu] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const menuRef = useRef<HTMLDivElement>(null);

  const handleConfirm = () => {
    deleteChat(chatId, {
      onSuccess: (data) => toast.success(data.message),
      onError: (error: Error) => {
        let msg = "Failed to delete chat";
        if (error instanceof AxiosError) {
          const data = error.response?.data as { error?: string };
          msg = data?.error || msg;
        }
        toast.error(msg);
      },
    });
    setShowConfirm(false);
    setShowMenu(false);
  };

  // Typing for this row, read off the one shared socket. Each row used to open
  // a realtime connection of its own, so a sidebar of N chats held N sockets.
  const handleTyping = useCallback(
    ({ userId: senderId, userName, typing }: TypingEvent) => {
      if (senderId === user?.id || !userName) return;

      if (isGroup) {
        if (!typing) {
          setTypingUsers((prev) => prev.filter((name) => name !== userName));
          if (typingTimeouts.current[senderId]) {
            clearTimeout(typingTimeouts.current[senderId]);
            delete typingTimeouts.current[senderId];
          }
          return;
        }

        setTypingUsers((prev) => Array.from(new Set([...prev, userName])));

        if (typingTimeouts.current[senderId]) {
          clearTimeout(typingTimeouts.current[senderId]);
        }
        typingTimeouts.current[senderId] = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((name) => name !== userName));
          delete typingTimeouts.current[senderId];
        }, TYPING_DELAY);
        return;
      }

      // A `typing: false` event used to be treated as "still typing", because
      // the handler never read the flag — the indicator only ever cleared by
      // timeout.
      if (!typing) {
        setIsTyping(false);
        if (typingTimeouts.current.single) {
          clearTimeout(typingTimeouts.current.single);
          delete typingTimeouts.current.single;
        }
        return;
      }

      setIsTyping(true);
      if (typingTimeouts.current.single) {
        clearTimeout(typingTimeouts.current.single);
      }
      typingTimeouts.current.single = setTimeout(() => {
        setIsTyping(false);
      }, TYPING_DELAY);
    },
    [isGroup, user?.id]
  );

  useTypingEvents(chatId, handleTyping, Boolean(chatId));

  useEffect(() => {
    const timeouts = typingTimeouts.current;
    return () => {
      Object.values(timeouts).forEach(clearTimeout);
    };
  }, [chatId]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  if (isUserLoading) {
    return <p>Loading user...</p>;
  }

  const typingDisplay =
    (isGroup && typingUsers.length > 0) || (!isGroup && isTyping) ? (
      <TypingIndicator
        users={isGroup ? typingUsers : []}
        isGroupChat={isGroup}
        size="sm"
      />
    ) : null;

  return (
    <div className="relative group">
      <div
        onClick={onClick}
        className="grid grid-cols-12 items-center px-3 py-2 hover:bg-blue-100 dark:hover:bg-[#1e1e3f] cursor-pointer transition-all"
      >
        {selectable && (
          <div className="col-span-1 flex justify-center">
            <div
              className={`w-[14px] h-[14px] rounded-sm border transition-all duration-150 ${
                seen
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "border-gray-400 bg-white dark:bg-black"
              } flex items-center justify-center`}
            >
              {seen && <Check size={14} strokeWidth={3} />}
            </div>
          </div>
        )}

        <div
          className={`${
            selectable ? "col-span-2" : "col-span-2"
          } flex justify-center`}
        >
          <img
            src={avatarSrc}
            alt="Avatar"
            className="h-10 w-10 rounded-full object-cover border border-gray-300 dark:border-gray-600"
          />
        </div>

        <div
          className={`${
            selectable ? "col-span-6" : "col-span-7"
          } overflow-hidden`}
        >
          <div
            className={`truncate text-sm ${
              !selectable
                ? seen
                  ? "text-gray-800 dark:text-gray-200"
                  : "text-gray-900 dark:text-gray-50 font-semibold"
                : "text-gray-800 dark:text-gray-200"
            }`}
          >
            {name}
          </div>

          <div
            className={`truncate text-xs w-full ${
              !selectable
                ? seen
                  ? "text-gray-600 dark:text-gray-400"
                  : "text-gray-800 dark:text-gray-200 font-medium"
                : "text-gray-600 dark:text-gray-400"
            }`}
          >
            {typingDisplay || message}
          </div>
        </div>

        <div className="col-span-3 flex items-center justify-end relative space-x-2">
          <span
            className={`text-xs ${
              seen
                ? "text-gray-600 dark:text-gray-300"
                : "text-gray-900 dark:text-gray-50 font-semibold"
            }`}
          >
            {time}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full p-1 transition-all"
          >
            <MoreVertical
              size={16}
              className="text-gray-700 dark:text-gray-300"
            />
          </button>
        </div>
      </div>

      {showMenu && (
        <div
          ref={menuRef}
          className="absolute right-4 top-10 bg-white dark:bg-[#121212] shadow-md border border-gray-200 dark:border-gray-700 rounded-md text-sm  w-36"
          style={{ zIndex: 9999 }}
        >
          {isGroup && currentUserId === user?.id && onEditClick && fullChat && (
            <button
              onClick={() => {
                onEditClick(fullChat);
                setShowMenu(false);
              }}
              className="w-full flex items-center px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-blue-950 text-blue-600 dark:text-blue-400"
            >
              ✏️ Edit Group
            </button>
          )}
          <button
            onClick={() => {
              setShowConfirm(true);
              setShowMenu(false);
            }}
            className="w-full flex items-center px-3 py-2 text-left hover:bg-red-50 dark:hover:bg-red-950 text-red-600 dark:text-red-400"
          >
            <Trash2 size={16} className="mr-2" />
            {isGroup ? "Leave Group" : "Delete Chat"}
          </button>
          {isGroup && (
            <button
              onClick={() => {
                if (fullChat) {
                  onViewMembersClick?.(fullChat);
                }
                setShowMenu(false);
              }}
              className="w-full flex items-center px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-blue-950 text-blue-600 dark:text-blue-400"
            >
              👥 View Members
            </button>
          )}
        </div>
      )}
      <ConfirmDialog
        isOpen={showConfirm}
        onCancel={() => setShowConfirm(false)}
        onConfirm={handleConfirm}
        title={isGroup ? "Leave Group Chat" : "Delete Chat"}
        description={
          isGroup
            ? "Are you sure you want to leave this group? You won't see this chat anymore."
            : "Are you sure you want to delete this chat for yourself?"
        }
        confirmText={isGroup ? "Leave" : "Delete"}
        cancelText="Cancel"
      />
    </div>
  );
};

export default ChatRow;
