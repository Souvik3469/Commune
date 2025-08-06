import React from "react";

type TypingIndicatorProps = {
  users?: string[];
  isGroupChat?: boolean;
  size?: "sm" | "md";
};

const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  users = [],
  isGroupChat = false,
  size = "md",
}) => {
  const userText = isGroupChat ? `${users.join(", ")} ` : "";

  const textSize = size === "sm" ? "text-xs" : "text-sm";

  return (
    <div
      className={`flex items-center gap-2 text-blue-600 italic ${textSize}`}
      title={userText ? `${userText} typing...` : "Typing..."}
    >
      {userText && <span className="truncate">{userText}</span>}
      <div className="flex space-x-1">
        <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:0s]" />
        <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:0.15s]" />
        <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:0.3s]" />
      </div>
    </div>
  );
};

export default TypingIndicator;
