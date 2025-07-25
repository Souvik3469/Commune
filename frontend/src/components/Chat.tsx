import { useEffect, useState } from "react";
import SideBar from "./SideBar";
import AllChats from "./AllChats";

import ChatBox from "./ChatBox";
import Notifications from "./Notifications";
import Settings from "./Settings";

const Chat = () => {
  const [active, setActive] = useState("home");
  const [isOpen, setIsOpen] = useState(false);
  const handleResize = () => {
    if (window.innerWidth < 768) {
      setActive("messages");
    } else {
      setActive("home");
    }
  };

  useEffect(() => {
    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);
  return (
    <div className="flex dark:bg-black">
      <SideBar
        active={active}
        setActive={setActive}
        isOpen={isOpen}
        setIsOpen={setIsOpen}
      />
      <div className={`flex w-full  ${isOpen ? "pl-12" : ""} sm:pl-36`}>
        {active === "home" && (
          <>
            <AllChats />
            <ChatBox />
          </>
        )}
        {active === "people" && <AllChats className="w-full pl-4 sm:pl-0" />}
        {active === "messages" && <ChatBox className="w-full" />}
        {active === "notifications" && <Notifications className="w-full" />}
        {active === "settings" && <Settings className="w-full" />}
      </div>
    </div>
  );
};

export default Chat;
