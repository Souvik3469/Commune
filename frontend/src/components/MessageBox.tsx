import { FC, useEffect, useRef, useState } from "react";
import { FaRegFaceSmile, FaMicrophone } from "react-icons/fa6";
import { CgAttachment } from "react-icons/cg";
import { RiSendPlaneFill } from "react-icons/ri";
import Ably from "ably";
import { useMyDetails } from "../hooks/userHooks";
import { useSendMessage } from "../hooks/chatHooks";
const ably = new Ably.Realtime(import.meta.env.VITE_ABLY_API_KEY!);
const TYPING_DELAY = 1000; // when to stop showing 'typing' after inactivity
const TYPING_REFRESH_INTERVAL = 1000;

type MessageBoxProps = {
  chatId: string;
  scrollToBottom: () => void;
};

const MessageBox: FC<MessageBoxProps> = ({ chatId, scrollToBottom }) => {
  const [content, setContent] = useState("");
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  const refreshTypingInterval = useRef<NodeJS.Timeout | null>(null);
  const isTyping = useRef(false);
  const channelRef = useRef<ReturnType<typeof ably.channels.get> | null>(null);

  const { data: user } = useMyDetails();
  const { mutate: sendMessage } = useSendMessage(() => {
    setTimeout(() => scrollToBottom(), 100);
  });

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
          // Publish the message to Ably for real-time preview updates
          const channel = ably.channels.get(`chat-${chatId}`);
          channel.publish("new-message", {
            chatId,
            content,
            senderName: user?.name,
            createdAt: new Date().toISOString(),
          });

          setContent("");
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
      }, TYPING_REFRESH_INTERVAL); // Refresh every 4s
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
    }, TYPING_DELAY); // Stop typing after 5s of no activity
  };

  return (
    <div className="bg-white dark:bg-black sticky bottom-0 z-10 border-t-[1px] border-gray-300 dark:border-gray-600">
      <div className="grid grid-cols-12 px-4 sm:px-8 py-2">
        <div className="col-span-9 flex items-center text-white">
          <FaRegFaceSmile className="text-gray-500 text-xl" />
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
