import { FC } from "react";
import {
  IoHomeOutline,
  IoHome,
  IoSettingsOutline,
  IoSettings,
  IoLogOutOutline,
  IoClose,
  IoPeople,
  IoPeopleOutline,
} from "react-icons/io5";

import { AiOutlineMessage, AiFillMessage } from "react-icons/ai";
import { BsBell, BsBellFill } from "react-icons/bs";
import { HiMenuAlt3 } from "react-icons/hi";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import ThemeToggleButton from "./ThemeToggleButton";
import { useMyDetails } from "../hooks/userHooks";

type MenuItem = {
  id: string;
  label: string;
  activeIcon: FC<{ className: string }>;
  inactiveIcon: FC<{ className: string }>;
  showOnMobile: boolean;
  showOnFull: boolean;
};

const menuItems: MenuItem[] = [
  {
    id: "home",
    label: "Home",
    activeIcon: IoHome,
    inactiveIcon: IoHomeOutline,
    showOnMobile: false,
    showOnFull: true,
  },
  {
    id: "messages",
    label: "Messages",
    activeIcon: AiFillMessage,
    inactiveIcon: AiOutlineMessage,
    showOnMobile: true,
    showOnFull: false,
  },
  {
    id: "people",
    label: "People",
    activeIcon: IoPeople,
    inactiveIcon: IoPeopleOutline,
    showOnMobile: true,
    showOnFull: false,
  },
  {
    id: "notifications",
    label: "Notifications",
    activeIcon: BsBellFill,
    inactiveIcon: BsBell,
    showOnMobile: true,
    showOnFull: true,
  },
  {
    id: "settings",
    label: "Settings",
    activeIcon: IoSettings,
    inactiveIcon: IoSettingsOutline,
    showOnMobile: true,
    showOnFull: true,
  },
];

type SideBarProps = {
  active: string;
  setActive: (id: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

const SideBar: FC<SideBarProps> = ({
  active,
  setActive,
  isOpen,
  setIsOpen,
}) => {
  const navigate = useNavigate();
  const { data: user, isLoading } = useMyDetails();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    toast.success("Logged out");
    navigate("/login");
  };

  const renderMenuItem = ({
    id,
    activeIcon: ActiveIcon,
    inactiveIcon: InactiveIcon,
    showOnMobile,
    showOnFull,
  }: MenuItem) => (
    <div
      key={id}
      className={`pr-4 py-2 pl-1 border-r-2 hover:border-[#FFE81A] ${
        active === id ? "border-[#FFE81A] bg-blue-700" : "border-transparent"
      } cursor-pointer rounded-s-lg hover:bg-blue-700 sm:pl-3 sm:pr-8 sm:py-3 sm:border-r-4 
    ${showOnMobile && !showOnFull ? "block sm:hidden" : ""} 
    ${!showOnMobile && showOnFull ? "hidden sm:block" : ""} 
    ${showOnMobile && showOnFull ? "block sm:block" : ""}`}
      onClick={() => {
        setActive(id);
        setIsOpen(false);
      }}
    >
      {active === id ? (
        <ActiveIcon className="text-lg sm:text-2xl text-white" />
      ) : (
        <InactiveIcon className="text-lg sm:text-2xl text-white" />
      )}
    </div>
  );

  return (
    <div>
      <button
        className="absolute top-4 left-4 z-50 sm:hidden text-white text-2xl"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <IoClose /> : <HiMenuAlt3 />}
      </button>

      <div
        className={`flex flex-col fixed z-50 w-14 h-[100%] items-end bg-[#1A66FF] transition-transform transform 
          ${isOpen ? "translate-x-0" : "-translate-x-full"} 
          sm:flex flex-col sm:fixed sm:m-4 sm:w-24 sm:h-[95%] sm:rounded-lg sm:items-end sm:translate-x-0`}
      >
        {isOpen && (
          <button
            className="absolute top-4 right-3 text-white text-2xl sm:hidden"
            onClick={() => setIsOpen(false)}
          >
            <IoClose />
          </button>
        )}

        <div className="mx-2 my-14 sm:mx-6 sm:my-10">
          <img
            src={user?.profilePic}
            alt={user?.name || "Avatar"}
            className="w-12 h-12 rounded-full"
          />
          <div>{user?.name}</div>
        </div>

        <div className="space-y-4 pt-6">{menuItems.map(renderMenuItem)}</div>

        <div className="pt-20">
          <div
            className={`pr-4 py-2 pl-1 border-r-2 border-transparent cursor-pointer rounded-s-lg hover:bg-blue-700 sm:pl-3 sm:pr-6 sm:py-3 sm:border-r-4`}
            onClick={handleLogout}
            title="Logout"
          >
            <IoLogOutOutline className="text-lg sm:text-3xl text-white" />
          </div>
        </div>

        <div className="pt-10">
          <div className="pr-2 py-2 pl-1 sm:pl-3 sm:pr-6 sm:py-3">
            <ThemeToggleButton />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SideBar;
