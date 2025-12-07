import React from "react";
import Draggable from "react-draggable";
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
} from "react-icons/fa";
import { ImPhoneHangUp } from "react-icons/im";
import { useCall } from "../context/CallContext";
import { createPortal } from "react-dom";

const CallDialog: React.FC = () => {
  const {
    inCall,
    toggleMuteAudio,
    toggleMuteVideo,
    isAudioMuted,
    isVideoMuted,
    endCall,
    localVideoRef,
    remoteVideoRef,
    remoteAudioRef,
  } = useCall();

  if (!inCall) return null;

  const dialog = (
    <Draggable cancel=".controls, button, a, input, textarea">
      <div
        className="fixed bottom-4 right-4 bg-black/90 p-3 rounded-xl shadow-lg z-[1000] w-[320px]"
        style={{
          touchAction: "none",
          WebkitUserSelect: "none",
          userSelect: "none",
        }}
      >
        <div className="relative w-full h-[180px] rounded-lg overflow-hidden bg-black">
          {/* Remote audio */}
          <audio
            ref={remoteAudioRef as React.RefObject<HTMLAudioElement>}
            autoPlay
            playsInline
          />

          {/* Remote video */}
          <video
            ref={remoteVideoRef as React.RefObject<HTMLVideoElement>}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />

          {/* Local video overlay */}
          <video
            ref={localVideoRef as React.RefObject<HTMLVideoElement>}
            autoPlay
            playsInline
            muted
            className="absolute bottom-2 right-2 w-24 h-16 rounded-md border border-white/50 object-cover"
          />
        </div>

        {/* Controls */}
        <div className="controls flex justify-center items-center space-x-5 mt-3">
          <button
            type="button"
            onClick={toggleMuteAudio}
            aria-label="Toggle mute audio"
            className="bg-gray-700 hover:bg-gray-600 active:scale-95 transition rounded-full p-3 text-white shadow-md flex items-center justify-center"
          >
            {isAudioMuted ? (
              <FaMicrophoneSlash size={18} />
            ) : (
              <FaMicrophone size={18} />
            )}
          </button>

          <button
            type="button"
            onClick={toggleMuteVideo}
            aria-label="Toggle video"
            className="bg-gray-700 hover:bg-gray-600 active:scale-95 transition rounded-full p-3 text-white shadow-md flex items-center justify-center"
          >
            {isVideoMuted ? <FaVideoSlash size={18} /> : <FaVideo size={18} />}
          </button>

          <button
            type="button"
            aria-label="End call"
            onClick={() => endCall(true)}
            className="bg-red-500 hover:bg-red-600 active:scale-95 transition rounded-full p-2 text-white shadow-lg flex items-center justify-center"
          >
            <ImPhoneHangUp size={22} className="pb-0.5" />
          </button>
        </div>
      </div>
    </Draggable>
  );

  return createPortal(dialog, document.body);
};

export default CallDialog;
