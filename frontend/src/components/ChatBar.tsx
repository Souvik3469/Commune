import { useEffect, useMemo, useRef, useState } from "react";
import {
  FaPhoneAlt,
  FaVideo,
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideoSlash,
} from "react-icons/fa";
import { BsThreeDotsVertical } from "react-icons/bs";
import { ChatPreview } from "../types/chat";
import { useMyDetails } from "../hooks/userHooks";
import { io, Socket } from "socket.io-client";
import Draggable from "react-draggable";

// --- RTC + Socket Config ---
const rtcConfig: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const socket: Socket = io(import.meta.env.VITE_API_BASE_URL, {
  autoConnect: false,
  withCredentials: true,
  transports: ["websocket"],
});

// --- Payload Types ---
interface OfferPayload {
  from: string;
  offer: RTCSessionDescriptionInit;
  video?: boolean;
}
interface AnswerPayload {
  answer: RTCSessionDescriptionInit;
}
interface CandidatePayload {
  candidate: RTCIceCandidateInit;
}

// --- Main Component ---
const ChatBar = ({ chat }: { chat: ChatPreview }) => {
  const { data: user, isLoading: isUserLoading } = useMyDetails();
  const currentUserId = user?.id;

  // --- State ---
  const [inCall, setInCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState<{
    fromId: string;
    hasVideo: boolean;
  } | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);

  // --- Refs ---
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // --- Chat Info ---
  const roomId = chat?.id?.toString();
  const otherUser = useMemo(
    () => chat?.users?.find((u) => u.id !== currentUserId),
    [chat?.users, currentUserId]
  );
  const isGroup = chat.isGroup;
  const displayName = isGroup ? chat.name : otherUser?.name || "Unknown";
  const displayAvatar = isGroup ? chat.logo : otherUser?.profilePic || "";

  // --- Media Controls ---
  const toggleMuteAudio = () => {
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
      setIsAudioMuted(!track.enabled);
    });
  };

  const toggleMuteVideo = () => {
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !track.enabled;
      setIsVideoMuted(!track.enabled);
    });
  };

  // --- Helpers ---
  const attachLocalPreview = async () => {
    if (!localVideoRef.current || !localStreamRef.current) return;
    localVideoRef.current.srcObject = localStreamRef.current;
    try {
      await localVideoRef.current.play();
    } catch (err) {
      console.warn("[webrtc] local preview play error", err);
    }
  };

  const attachRemoteToElements = async () => {
    const remoteStream = remoteStreamRef.current;
    if (!remoteStream) return;

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.muted = true;
      await remoteVideoRef.current
        .play()
        .catch((e) => console.error("remoteVideo play failed", e));
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.muted = false;
      remoteAudioRef.current.volume = 1;
      await remoteAudioRef.current
        .play()
        .catch((e) => console.error("remoteAudio play failed", e));
    }
  };

  const stopLocalMedia = () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
  };

  const cleanupPeer = () => {
    try {
      peerConnectionRef.current?.getSenders().forEach((s) => s.track?.stop());
      peerConnectionRef.current?.close();
    } catch (err) {
      console.error(err);
    }
    peerConnectionRef.current = null;
  };

  const createPeerConnection = () => {
    if (peerConnectionRef.current) return peerConnectionRef.current;
    const pc = new RTCPeerConnection(rtcConfig);
    remoteStreamRef.current = new MediaStream();

    pc.ontrack = async (event) => {
      try {
        remoteStreamRef.current!.addTrack(event.track);
      } catch {
        console.error("addTrack error (maybe duplicate)");
      }
      await attachRemoteToElements();
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && roomId) {
        socket.emit("candidate", { roomId, candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
        endCall(false);
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  const endCall = (notifyPeer = true) => {
    if (notifyPeer && roomId) {
      socket.emit("end-call", { roomId });
    }
    stopLocalMedia();
    cleanupPeer();
    remoteStreamRef.current = null;
    setInCall(false);
    setIncomingCall(null);
  };

  // --- Effects ---
  useEffect(() => {
    if (inCall) {
      attachLocalPreview();
      setTimeout(() => attachRemoteToElements(), 0);
    }
  }, [inCall]);

  useEffect(() => {
    if (!roomId || !currentUserId) return;
    if (!socket.connected) socket.connect();

    socket.emit("join", { roomId, userId: currentUserId });

    const onOffer = async ({ from, offer, video }: OfferPayload) => {
      const pc = createPeerConnection();
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      setIncomingCall({ fromId: from, hasVideo: !!video });
    };

    const onAnswer = async ({ answer }: AnswerPayload) => {
      await peerConnectionRef.current?.setRemoteDescription(
        new RTCSessionDescription(answer)
      );
    };

    const onCandidate = async ({ candidate }: CandidatePayload) => {
      try {
        await peerConnectionRef.current?.addIceCandidate(
          new RTCIceCandidate(candidate)
        );
      } catch (e) {
        console.error("[webrtc] addIceCandidate error", e);
      }
    };

    socket.on("offer", onOffer);
    socket.on("answer", onAnswer);
    socket.on("candidate", onCandidate);
    socket.on("end-call", () => endCall(false));

    return () => {
      socket.off("offer", onOffer);
      socket.off("answer", onAnswer);
      socket.off("candidate", onCandidate);
      socket.off("end-call");
      socket.emit("leave", { roomId, userId: currentUserId });
    };
  }, [roomId, currentUserId]);

  // --- Call Actions ---
  const startCall = async (video: boolean) => {
    if (!roomId || !currentUserId) return;
    if (!socket.connected) socket.connect();

    const pc = createPeerConnection();
    try {
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({
        video,
        audio: true,
      });
    } catch (err) {
      console.error("[webrtc] getUserMedia failed", err);
      return;
    }

    localStreamRef.current
      .getTracks()
      .forEach((track) => pc.addTrack(track, localStreamRef.current!));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit("offer", { roomId, from: currentUserId, offer, video });
    setInCall(true);
  };

  const acceptCall = async () => {
    if (
      !roomId ||
      !currentUserId ||
      !peerConnectionRef.current ||
      !incomingCall
    )
      return;

    try {
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({
        video: incomingCall.hasVideo,
        audio: true,
      });
    } catch (err) {
      console.error("[webrtc] getUserMedia failed on accept", err);
      return;
    }

    localStreamRef.current
      .getTracks()
      .forEach((track) =>
        peerConnectionRef.current!.addTrack(track, localStreamRef.current!)
      );

    const answer = await peerConnectionRef.current!.createAnswer();
    await peerConnectionRef.current!.setLocalDescription(answer);

    socket.emit("answer", { roomId, from: currentUserId, answer });
    setInCall(true);
    setIncomingCall(null);

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
      localVideoRef.current.muted = true;
      localVideoRef.current
        .play()
        .catch((e) => console.error("local preview play failed", e));
    }

    setTimeout(() => attachRemoteToElements(), 0);
  };

  const rejectCall = () => {
    setIncomingCall(null);
    stopLocalMedia();
    cleanupPeer();
  };

  // --- Render ---
  if (isUserLoading) return <p>Loading user...</p>;

  return (
    <div className="grid grid-cols-12 p-2 bg-white dark:bg-black border-b border-gray-300 dark:border-gray-700 sticky top-0 z-10">
      {/* Chat Info */}
      <div className="col-span-9 flex items-center mx-2">
        <img
          src={displayAvatar}
          className="h-12 w-12 rounded-full object-cover"
          alt="avatar"
        />
        <div className="mx-3">
          <div className="text-sm text-gray-800 dark:text-gray-200">
            {displayName}
          </div>
          {!isGroup && <div className="text-xs text-blue-600">Online</div>}
        </div>
      </div>

      {/* Action Icons */}
      <div className="col-span-3 flex items-center space-x-6 justify-end mx-4">
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
        <BsThreeDotsVertical className="text-xl text-gray-400" />
      </div>

      {/* Incoming Call Popup */}
      {incomingCall && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg flex items-center gap-3">
          <span className="text-gray-800 dark:text-gray-200">
            Incoming {incomingCall.hasVideo ? "video" : "audio"} call from{" "}
            {displayName}
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
      )}

      {/* Call UI */}
      {inCall && (
        <Draggable cancel=".controls, button, a, input, textarea">
          <div
            className="fixed bottom-4 right-4 bg-black/90 p-2 rounded-lg shadow-lg z-50"
            style={{
              touchAction: "none",
              WebkitUserSelect: "none",
              userSelect: "none",
            }}
          >
            <div className="relative">
              <audio ref={remoteAudioRef} autoPlay playsInline />
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted
                className="w-64 h-48 bg-black rounded"
              />
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-28 h-20 absolute bottom-2 right-2 border border-white rounded"
              />
            </div>

            <div className="controls flex space-x-3 mt-2">
              <button
                type="button"
                onClick={toggleMuteAudio}
                className="bg-gray-700 px-3 py-1 rounded text-white"
              >
                {isAudioMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
              </button>
              <button
                type="button"
                onClick={toggleMuteVideo}
                className="bg-gray-700 px-3 py-1 rounded text-white"
              >
                {isVideoMuted ? <FaVideoSlash /> : <FaVideo />}
              </button>
              <button
                type="button"
                className="bg-red-500 px-3 py-1 rounded text-white flex-1"
                onClick={() => endCall(true)}
              >
                End Call
              </button>
            </div>
          </div>
        </Draggable>
      )}
    </div>
  );
};

export default ChatBar;
