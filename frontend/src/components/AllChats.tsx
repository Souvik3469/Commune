import { IoSearch } from "react-icons/io5";
import logo from "../assets/logo1.png";
import ChatSection from "./ChatSection";
import { FaPlus } from "react-icons/fa6";
import { FC } from "react";
import { groupChats, allChats } from "../data/chatData";

type AllChatsProps = {
  className?: string;
};

const AllChats: FC<AllChatsProps> = ({ className }) => {
  return (
    <div
      className={`w-[30%] h-screen border-r-[1px]  border-gray-300 dark:border-gray-700 ${className}`}
    >
      <div className="mt-1 mb-2">
        <div className="flex  items-center my-2">
          <div>
            <img src={logo} className="h-12 w-12" />
          </div>
          <div className="text-xl font-bold">
            <span className="text-blue-600 dark:text-blue-400">Com</span>
            <span className="text-blue-300 dark:text-white">mune</span>
          </div>
        </div>
      </div>

      <div className="flex items-center">
        <div className="relative w-[80%]">
          <input
            className="border-[1px] border-gray-300 dark:border-gray-700 dark:bg-black rounded-md text-gray-300 text-sm p-2 pl-8 w-full"
            placeholder="Search messages and people"
          />
          <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400">
            <IoSearch className="text-lg" />
          </span>
        </div>
        <div>
          <button className="bg-[#00A3FF] mx-2 p-2 rounded-lg">
            <FaPlus className="text-white text-xl" />
          </button>
        </div>
      </div>

      <ChatSection title="GROUP CHATS" chats={groupChats} isGroup={true} />
      <ChatSection title="ALL CHATS" chats={allChats} isGroup={false} />
    </div>
  );
};

export default AllChats;
