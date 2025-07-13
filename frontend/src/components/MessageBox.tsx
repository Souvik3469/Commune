import { FaRegFaceSmile } from "react-icons/fa6";
import { FaMicrophone } from "react-icons/fa6";
import { RiSendPlaneFill } from "react-icons/ri";
import { CgAttachment } from "react-icons/cg";
const MessageBox = () => {
  return (
    <div className="bg-white dark:bg-black sticky bottom-0 z-10 border-t-[1px] border-gray-300 dark:border-gray-600 grid grid-cols-12 px-4 sm:px-8 py-2">
      <div className="col-span-9 flex items-center text-white">
        <div>
          <FaRegFaceSmile className="text-gray-500 text-xl" />
        </div>
        <input
          className=" mx-2 dark:bg-black w-full p-1 placeholder-gray-500"
          placeholder="Type message..."
        />
      </div>
      <div className="col-span-3 flex items-center space-x-4 justify-end">
        <div>
          <FaMicrophone className="text-xl text-gray-500" />
        </div>
        <div>
          <CgAttachment className="text-xl text-gray-500" />
        </div>
        <div>
          <button className="bg-[#00A3FF] text-white flex items-center p-1 rounded-md px-2">
            <div className="text-sm">Send</div>
            <RiSendPlaneFill className="text-xl ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageBox;
