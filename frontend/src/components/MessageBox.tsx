import { FC, useEffect, useRef, useState } from "react";
import { FaRegFaceSmile, FaMicrophone } from "react-icons/fa6";
import { CgAttachment } from "react-icons/cg";
import { RiSendPlaneFill } from "react-icons/ri";
import Ably from "ably";
import { useMyDetails } from "../hooks/userHooks";
import { useSendMessage } from "../hooks/messageHooks";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import { useTheme } from "../context/ThemeContext";
import { EmojiSelectEvent } from "../types/generic";

const ably = new Ably.Realtime(import.meta.env.VITE_ABLY_API_KEY!);
const TYPING_DELAY = 1000;
const TYPING_REFRESH_INTERVAL = 1000;

type MessageBoxProps = {
  chatId: string;
  scrollToBottom: () => void;
};

const MessageBox: FC<MessageBoxProps> = ({ chatId, scrollToBottom }) => {
  const [content, setContent] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  const refreshTypingInterval = useRef<NodeJS.Timeout | null>(null);
  const isTyping = useRef(false);
  const channelRef = useRef<ReturnType<typeof ably.channels.get> | null>(null);

  const { data: user } = useMyDetails();
  const { mutate: sendMessage } = useSendMessage(() => {
    setTimeout(() => scrollToBottom(), 100);
  });
  const { isDarkMode } = useTheme();

  useEffect(() => {
    const channel = ably.channels.get(`chat-${chatId}`);
    channelRef.current = channel;

    return () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      if (refreshTypingInterval.current)
        clearInterval(refreshTypingInterval.current);
      isTyping.current = false;
      channelRef.current?.detach();
    };
  }, [chatId]);

  const handleSend = () => {
    if (!content.trim()) return;
    sendMessage(
      { chatId, content },
      {
        onSuccess: () => {
          const channel = ably.channels.get(`chat-${chatId}`);
          channel.publish("new-message", {
            chatId,
            content,
            senderName: user?.name,
            createdAt: new Date().toISOString(),
          });
          setContent("");
          setShowEmojiPicker(false);
          setTimeout(() => scrollToBottom(), 100);
        },
      }
    );
  };

  const handleTyping = () => {
    if (!channelRef.current || !user?.id) return;

    if (!isTyping.current) {
      isTyping.current = true;
      channelRef.current.publish("typing", {
        typing: true,
        userId: user.id,
        userName: user.name,
      });
      refreshTypingInterval.current = setInterval(() => {
        channelRef.current?.publish("typing", {
          typing: true,
          userId: user.id,
          userName: user.name,
        });
      }, TYPING_REFRESH_INTERVAL);
    }
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      isTyping.current = false;
      channelRef.current?.publish("typing", {
        typing: false,
        userId: user.id,
        userName: user.name,
      });
      if (refreshTypingInterval.current) {
        clearInterval(refreshTypingInterval.current);
      }
    }, TYPING_DELAY);
  };

  const handleEmojiSelect = (emoji: EmojiSelectEvent) => {
    setContent((prev) => prev + emoji.native);
    setShowEmojiPicker(false);
  };

  return (
    <div className="bg-white dark:bg-black sticky bottom-0 z-10 border-t-[1px] border-gray-300 dark:border-gray-600">
      <div className="grid grid-cols-12 px-4 sm:px-8 py-2 relative">
        <div className="col-span-9 flex items-center text-white relative">
          <FaRegFaceSmile
            className="text-gray-500 text-xl cursor-pointer"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          />
          <input
            className="mx-2 dark:bg-black w-full p-1 placeholder-gray-500 text-black dark:text-white"
            placeholder="Type message..."
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              handleTyping();
            }}
            onKeyDown={(e) => {
              handleTyping();
              if (e.key === "Enter") handleSend();
            }}
          />
          {showEmojiPicker && (
            <div className="absolute bottom-12 left-0 z-50">
              <Picker
                data={data}
                onEmojiSelect={handleEmojiSelect}
                theme={isDarkMode ? "dark" : "light"}
              />
            </div>
          )}
        </div>
        <div className="col-span-3 flex items-center space-x-4 justify-end">
          <FaMicrophone className="text-xl text-gray-500" />
          <CgAttachment className="text-xl text-gray-500" />
          <button
            className="bg-[#00A3FF] text-white flex items-center p-1 rounded-md px-2"
            onClick={handleSend}
          >
            <span className="text-sm">Send</span>
            <RiSendPlaneFill className="text-xl ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageBox;
