import React from "react";
import { FaPhoneAlt, FaVideo } from "react-icons/fa";
import { useCall } from "../context/CallContext";

export const CallButtons: React.FC<{ title?: string }> = ({ title }) => {
  const { startCall } = useCall();
  return (
    <div className="flex items-center space-x-6 justify-end mx-4" title={title}>
      <FaPhoneAlt
        className="text-xl text-gray-400 cursor-pointer"
        onClick={() => startCall(false)}
        title="Start audio call"
      />
      <FaVideo
        className="text-xl text-gray-400 cursor-pointer"
        onClick={() => startCall(true)}
        title="Start video call"
      />
    </div>
  );
};
