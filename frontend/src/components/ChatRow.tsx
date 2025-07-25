import { FC } from "react";
type ChatRowProps = {
  name: string;
  message: string;
  time: string;
  avatarSrc: string;
  seen: boolean;
};
const ChatRow: FC<ChatRowProps> = ({
  name,
  message,
  time,
  avatarSrc,
  seen,
}) => (
  <div className="grid grid-cols-12 items-center pt-2 pb-2 hover:bg-[#b2d5e9] dark:hover:bg-[#06053a] cursor-pointer">
    <div className="col-span-2 mx-2">
      <img src={avatarSrc} alt="Avatar" className="h-10 w-10 rounded-full" />
    </div>
    <div className="col-span-7">
      <div
        className={` text-sm ${
          seen
            ? "text-gray-800 dark:text-gray-200"
            : "text-gray-900 dark:text-gray-50 font-semibold"
        }`}
      >
        {name}
      </div>
      <div className="flex flex-row ">
        <div
          className={`text-xs w-[90%] ${
            seen
              ? "text-gray-600 dark:text-gray-400"
              : "text-gray-800 dark:text-gray-200 font-semibold"
          }`}
        >
          {message}
          {!seen && (
            <div className="h-[4px] w-[4px] inline-block bg-blue-500 rounded-full ml-2 align-middle"></div>
          )}
        </div>
      </div>
    </div>
    <div
      className={`col-span-3 ${
        seen
          ? "text-gray-600 dark:text-gray-300"
          : "text-gray-900 dark:text-gray-50 font-semibold"
      }  text-xs mx-2 text-center`}
    >
      {time}
    </div>
  </div>
);

export default ChatRow;
