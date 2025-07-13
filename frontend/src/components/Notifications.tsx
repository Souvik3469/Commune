import { FC } from "react";
type NotificationsProps = {
  className?: string;
};
const Notifications: FC<NotificationsProps> = ({ className }) => {
  return (
    <div
      className={`text-2xl text-gray-800 dark:text-gray-200 w-[30%] h-screen border-r-[1px]  border-gray-700 ${className}`}
    >
      Notifications
    </div>
  );
};

export default Notifications;
