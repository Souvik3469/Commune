import { FC } from "react";

type NotificationsProps = {
  className?: string;
};

const Notifications: FC<NotificationsProps> = ({ className }) => {
  return (
    <div
      className={`flex items-center justify-center text-2xl text-gray-800 dark:text-gray-200 w-[30%] h-screen border-r border-gray-700 ${className}`}
    >
      No new notifications
    </div>
  );
};

export default Notifications;
