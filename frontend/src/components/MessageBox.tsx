import { FC, useEffect, useRef, useState } from "react";
import { FaRegFaceSmile, FaMicrophone } from "react-icons/fa6";
import { CgAttachment } from "react-icons/cg";
import { RiSendPlaneFill } from "react-icons/ri";
import { useMyDetails } from "../hooks/userHooks";
import { useSendMessage } from "../hooks/messageHooks";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import { useTheme } from "../context/ThemeContext";
import { EmojiSelectEvent } from "../types/generic";
import toast from "react-hot-toast";
import { emitTyping } from "../hooks/realtimeHooks";

const TYPING_DELAY = 1000;
const TYPING_REFRESH_INTERVAL = 1000;

type MessageBoxProps = {
  chatId: string;
  scrollToBottom: () => void;
};

const MessageBox: FC<MessageBoxProps> = ({ chatId, scrollToBottom }) => {
  const [content, setContent] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  const refreshTypingInterval = useRef<NodeJS.Timeout | null>(null);
  const isTyping = useRef(false);

  const { data: user } = useMyDetails();
  const { mutateAsync: sendMessage } = useSendMessage(() => {
    setTimeout(() => scrollToBottom(), 100);
  });
  const { isDarkMode } = useTheme();

  useEffect(() => {
    return () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      if (refreshTypingInterval.current)
        clearInterval(refreshTypingInterval.current);
      // Tell the room we stopped: switching chats mid-keystroke used to leave
      // a typing indicator stuck on the other side until it timed out.
      if (isTyping.current) emitTyping(chatId, false);
      isTyping.current = false;
    };
  }, [chatId]);

  const handleSend = async () => {
    if (!content.trim() || isSending) return;

    setIsSending(true);
    try {
      await sendMessage({ chatId, content });
      // The sidebar preview used to be driven by a message the *sender's*
      // browser published, so a recipient's list never updated until reload.
      // The server now fans the persisted message out to everyone in the room.

      setContent("");
      setShowEmojiPicker(false);
      scrollToBottom();

      // toast.success("Message sent", { id: "send-message" });
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message. Please try again.", {
        id: "send-message",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleTyping = () => {
    if (!user?.id) return;

    if (!isTyping.current) {
      isTyping.current = true;
      emitTyping(chatId, true);
      refreshTypingInterval.current = setInterval(() => {
        emitTyping(chatId, true);
      }, TYPING_REFRESH_INTERVAL);
    }
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      isTyping.current = false;
      emitTyping(chatId, false);
      if (refreshTypingInterval.current) {
        clearInterval(refreshTypingInterval.current);
        refreshTypingInterval.current = null;
      }
    }, TYPING_DELAY);
  };

  const handleEmojiSelect = (emoji: EmojiSelectEvent) => {
    setContent((prev) => prev + emoji.native);
    setShowEmojiPicker(false);
  };

  return (
    <div className="bg-white dark:bg-black sticky bottom-0 z-10 border-t border-gray-300 dark:border-gray-600">
      <div className="grid grid-cols-12 px-4 sm:px-8 py-2 relative">
        <div className="col-span-9 flex items-center relative">
          <FaRegFaceSmile
            className="text-gray-500 text-xl cursor-pointer"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
          />
          <input
            className="mx-2 dark:bg-black w-full p-1 placeholder-gray-500 text-black dark:text-white"
            placeholder="Type message..."
            value={content}
            disabled={isSending}
            onChange={(e) => {
              setContent(e.target.value);
              handleTyping();
            }}
            onKeyDown={(e) => {
              if (isSending) return;
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
            className={`bg-[#00A3FF] text-white flex items-center p-1 rounded-md px-2 ${
              isSending ? "opacity-60 cursor-not-allowed" : ""
            }`}
            onClick={handleSend}
            disabled={isSending}
          >
            <span className="text-sm">{isSending ? "Sending..." : "Send"}</span>
            {!isSending && <RiSendPlaneFill className="text-xl ml-2" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageBox;
