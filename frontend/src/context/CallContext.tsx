import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getSocket } from "../lib/socket";
import type {
  AnswerPayload,
  CandidatePayload,
  IncomingCall,
  OfferPayload,
} from "../types/call";

const rtcConfig: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export type CallContextValue = {
  inCall: boolean;
  incomingCall: IncomingCall | null;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  displayName: string;
  displayAvatar: string;

  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteAudioRef: React.RefObject<HTMLAudioElement | null>;

  joinRoom: (
    roomId: string,
    userId: string,
    displayName: string,
    displayAvatar: string,
    otherUserId?: string | null
  ) => void;
  leaveRoom: () => void;
  startCall: (video: boolean) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: (notifyPeer?: boolean) => void;
  toggleMuteAudio: () => void;
  toggleMuteVideo: () => void;

  roomId: string | null;
  currentUserId: string | null;
  registerUser: (userId: string | null) => void;
};

const CallContext = createContext<CallContextValue | null>(null);

export const useCall = (): CallContextValue => {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used within CallProvider");
  return ctx;
};

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [displayAvatar, setDisplayAvatar] = useState("");

  const [inCall, setInCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);

  const [currentChatOtherUserId, setCurrentChatOtherUserId] = useState<
    string | null
  >(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  const remoteUserIdRef = useRef<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const socket = useMemo(() => getSocket(), []);

  // Attach local preview
  const attachLocalPreview = useCallback(async () => {
    if (!localVideoRef.current || !localStreamRef.current) return;
    localVideoRef.current.srcObject = localStreamRef.current;
    try {
      await localVideoRef.current.play();
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Attach remote stream to elements
  const attachRemoteToElements = useCallback(async () => {
    const remoteStream = remoteStreamRef.current;
    if (!remoteStream) return;

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.muted = true;
      try {
        await remoteVideoRef.current.play();
      } catch (err) {
        console.error(err);
      }
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.muted = false;
      remoteAudioRef.current.volume = 1;
      try {
        await remoteAudioRef.current.play();
      } catch (err) {
        console.error(err);
      }
    }
  }, []);

  const stopLocalMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
  }, []);

  const cleanupPeer = useCallback(() => {
    try {
      peerConnectionRef.current?.getSenders().forEach((s) => s.track?.stop());
      peerConnectionRef.current?.close();
    } catch (err) {
      console.error(err);
    }
    peerConnectionRef.current = null;
  }, []);

  const createPeerConnection = useCallback(() => {
    if (peerConnectionRef.current) return peerConnectionRef.current;
    const pc = new RTCPeerConnection(rtcConfig);
    remoteStreamRef.current = new MediaStream();

    pc.ontrack = async (event) => {
      try {
        remoteStreamRef.current!.addTrack(event.track);
      } catch (e) {
        console.error(e);
      }
      await attachRemoteToElements();
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const to = remoteUserIdRef.current ?? null;
        socket.emit("candidate", {
          roomId,
          candidate: event.candidate,
          to,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
        endCall(false);
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [attachRemoteToElements, roomId, socket]);

  const endCall = useCallback(
    (notifyPeer = true) => {
      const to = remoteUserIdRef.current ?? null;
      if (notifyPeer) socket.emit("end-call", { roomId, to });
      stopLocalMedia();
      cleanupPeer();
      remoteStreamRef.current = null;
      setInCall(false);
      setIncomingCall(null);
      setIsAudioMuted(false);
      setIsVideoMuted(false);
      remoteUserIdRef.current = null;
    },
    [cleanupPeer, roomId, socket, stopLocalMedia]
  );

  const toggleMuteAudio = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
      setIsAudioMuted(!track.enabled);
    });
  }, []);

  const toggleMuteVideo = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !track.enabled;
      setIsVideoMuted(!track.enabled);
    });
  }, []);

  const joinRoom = useCallback(
    (
      rId: string,
      uId: string,
      dName: string,
      dAvatar: string,
      otherUserId?: string | null
    ) => {
      if (!socket.connected) socket.connect();
      setRoomId(rId);
      setCurrentUserId(uId);
      setDisplayName(dName);
      setDisplayAvatar(dAvatar);
      setCurrentChatOtherUserId(otherUserId ?? null);

      socket.emit("register", { userId: uId });
      socket.emit("join", { roomId: rId, userId: uId });
    },
    [socket]
  );

  const leaveRoom = useCallback(() => {
    if (roomId && currentUserId)
      socket.emit("leave", { roomId, userId: currentUserId });
    setRoomId(null);
    // setCurrentUserId(null);
    setCurrentChatOtherUserId(null);
  }, [currentUserId, roomId, socket]);

  // Handle incoming signaling
  useEffect(() => {
    const onOffer = async ({
      from,
      offer,
      video,
      callerName,
      callerAvatar,
      roomId: incomingRoomId,
    }: OfferPayload & {
      callerName?: string;
      callerAvatar?: string;
      roomId?: string;
    }) => {
      remoteUserIdRef.current = from;
      const pc = createPeerConnection();
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
      } catch (e) {
        console.error("setRemoteDescription on offer failed", e);
      }

      // track caller's roomId if sent by backend (optional)
      if (incomingRoomId) setRoomId(incomingRoomId);

      setIncomingCall({
        fromId: from,
        hasVideo: !!video,
        callerName: callerName || "Unknown User",
        callerAvatar: callerAvatar || "",
      });
    };

    const onAnswer = async ({ answer }: AnswerPayload) => {
      try {
        await peerConnectionRef.current?.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
      } catch (err) {
        console.error(err);
      }
    };

    const onCandidate = async ({ candidate }: CandidatePayload) => {
      try {
        await peerConnectionRef.current?.addIceCandidate(
          new RTCIceCandidate(candidate)
        );
      } catch (e) {
        console.error("addIceCandidate error", e);
      }
    };

    const onEnd = () => endCall(false);

    socket.on("offer", onOffer);
    socket.on("answer", onAnswer);
    socket.on("candidate", onCandidate);
    socket.on("end-call", onEnd);

    return () => {
      socket.off("offer", onOffer);
      socket.off("answer", onAnswer);
      socket.off("candidate", onCandidate);
      socket.off("end-call", onEnd);
    };
  }, [createPeerConnection, endCall, socket]);

  useEffect(() => {
    if (inCall) {
      attachLocalPreview();
      setTimeout(() => attachRemoteToElements(), 0);
    }
  }, [attachLocalPreview, attachRemoteToElements, inCall]);

  const registerUser = useCallback(
    (userId: string | null) => {
      setCurrentUserId(userId);
      if (!userId) return;
      if (!socket.connected) socket.connect();
      socket.emit("register", { userId });
    },
    [socket]
  );

  // 3) ensure we re-register on socket reconnect
  useEffect(() => {
    const onConnect = () => {
      if (currentUserId) socket.emit("register", { userId: currentUserId });
    };
    socket.on("connect", onConnect);
    return () => {
      socket.off("connect", onConnect);
    };
  }, [socket, currentUserId]);

  // Caller
  const startCall = useCallback(
    async (video: boolean) => {
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

      remoteUserIdRef.current = currentChatOtherUserId;
      socket.emit("offer", {
        roomId,
        from: currentUserId,
        offer,
        video,
        to: remoteUserIdRef.current ?? null,
        callerName: displayName,
        callerAvatar: displayAvatar,
      });

      setInCall(true);
    },
    [
      createPeerConnection,
      currentChatOtherUserId,
      currentUserId,
      roomId,
      socket,
      displayName,
      displayAvatar,
    ]
  );

  // Callee (ACCEPT) — MINIMAL FIX: don't require roomId, ensure pc exists, always target caller via `to`
  const acceptCall = useCallback(
    async () => {
      // require current user and incomingCall — do NOT require roomId
      if (!currentUserId || !incomingCall) return;

      // ensure we have a peer connection (onOffer should have created one, but be safe)
      const pc = peerConnectionRef.current ?? createPeerConnection();

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
        .forEach((track) => pc.addTrack(track, localStreamRef.current!));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const to = incomingCall.fromId;
      // include `to` so backend forwards directly to caller (backend prefers `to`)
      socket.emit("answer", {
        roomId: roomId ?? null,
        from: currentUserId,
        answer,
        to,
      });

      remoteUserIdRef.current = incomingCall.fromId;

      setInCall(true);
      setIncomingCall(null);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
        localVideoRef.current.muted = true;
        try {
          await localVideoRef.current.play();
        } catch (err) {
          console.error(err);
        }
      }
      setTimeout(() => attachRemoteToElements(), 0);
    },
    // include createPeerConnection in deps because we call it
    [
      attachRemoteToElements,
      createPeerConnection,
      currentUserId,
      incomingCall,
      roomId,
      socket,
    ]
  );

  const rejectCall = useCallback(() => {
    setIncomingCall(null);
    stopLocalMedia();
    cleanupPeer();
    remoteUserIdRef.current = null;
  }, [cleanupPeer, stopLocalMedia]);

  const value: CallContextValue = {
    inCall,
    incomingCall,
    isAudioMuted,
    isVideoMuted,
    displayName,
    displayAvatar,
    localVideoRef,
    remoteVideoRef,
    remoteAudioRef,
    joinRoom,
    leaveRoom,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMuteAudio,
    toggleMuteVideo,
    roomId,
    currentUserId,
    registerUser,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
};
