import React from "react";
import { useCall } from "../context/CallContext";

const IncomingCallPopup: React.FC = () => {
  console.log("ACCEPT");
  const { incomingCall, acceptCall, rejectCall } = useCall();
  console.log("IN", incomingCall);
  console.log("AC", acceptCall);
  console.log("RE", rejectCall);
  if (!incomingCall) return null;

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg flex items-center gap-3 z-[1000]">
      <span className="text-gray-800 dark:text-gray-200">
        Incoming {incomingCall.hasVideo ? "video" : "audio"} call from{" "}
        {incomingCall.callerName}
      </span>
      <button
        className="bg-green-500 px-3 py-1 rounded text-white"
        onClick={acceptCall}
      >
        Accept
      </button>
      <button
        className="bg-red-500 px-3 py-1 rounded text-white"
        onClick={rejectCall}
      >
        Reject
      </button>
    </div>
  );
};

export default IncomingCallPopup;
