import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

interface OfferPayload {
  from: string;
  offer: RTCSessionDescriptionInit;
  video?: boolean;
}
interface AnswerPayload {
  from: string;
  answer: RTCSessionDescriptionInit;
}
interface CandidatePayload {
  from: string;
  candidate: RTCIceCandidateInit;
}

const rtcConfig: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const socket: Socket = io(import.meta.env.VITE_API_BASE_URL, {
  autoConnect: false,
  withCredentials: true,
  transports: ["websocket"],
});

export function useWebRTC(
  roomId: string | undefined,
  userId: string | undefined
) {
  const [inCall, setInCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState<{
    fromId: string;
    hasVideo: boolean;
  } | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // --- helpers ---
  const stopLocal = () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
  };

  const cleanupPeer = () => {
    peerRef.current?.getSenders().forEach((s) => s.track?.stop());
    peerRef.current?.close();
    peerRef.current = null;
  };

  const attachLocal = useCallback(async () => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
      await localVideoRef.current.play().catch(() => {});
    }
  }, []);

  const attachRemote = useCallback(async () => {
    if (!remoteStreamRef.current) return;
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
      await remoteVideoRef.current.play().catch(() => {});
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStreamRef.current;
      remoteAudioRef.current.muted = false;
      remoteAudioRef.current.volume = 1;
      await remoteAudioRef.current.play().catch(() => {});
    }
  }, []);

  const endCall = useCallback(
    (notify = true) => {
      if (notify && roomId) socket.emit("end-call", { roomId });
      stopLocal();
      cleanupPeer();
      remoteStreamRef.current = null;
      setInCall(false);
      setIncomingCall(null);
    },
    [roomId]
  );

  const createPeer = useCallback(() => {
    if (peerRef.current) return peerRef.current;
    const pc = new RTCPeerConnection(rtcConfig);
    remoteStreamRef.current = new MediaStream();

    pc.ontrack = (e) => {
      remoteStreamRef.current!.addTrack(e.track);
      attachRemote();
    };
    pc.onicecandidate = (e) => {
      if (e.candidate && roomId)
        socket.emit("candidate", { roomId, candidate: e.candidate });
    };
    pc.onconnectionstatechange = () => {
      if (["disconnected", "failed", "closed"].includes(pc.connectionState))
        endCall(false);
    };

    peerRef.current = pc;
    return pc;
  }, [roomId, attachRemote, endCall]);

  // --- socket events ---
  useEffect(() => {
    if (!roomId || !userId) return;
    if (!socket.connected) socket.connect();
    socket.emit("join", { roomId, userId });

    const onOffer = async ({ from, offer, video }: OfferPayload) => {
      const pc = createPeer();
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      setIncomingCall({ fromId: from, hasVideo: !!video });
    };
    const onAnswer = async ({ answer }: AnswerPayload) => {
      await peerRef.current?.setRemoteDescription(
        new RTCSessionDescription(answer)
      );
    };
    const onCandidate = async ({ candidate }: CandidatePayload) => {
      await peerRef.current
        ?.addIceCandidate(new RTCIceCandidate(candidate))
        .catch(console.error);
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
      socket.emit("leave", { roomId, userId });
    };
  }, [roomId, userId, createPeer, endCall]);

  // --- call actions ---
  const startCall = async (video: boolean) => {
    if (!roomId || !userId) return;
    const pc = createPeer();
    try {
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({
        video,
        audio: true,
      });
    } catch (err) {
      console.error("getUserMedia failed", err);
      return;
    }
    localStreamRef.current
      .getTracks()
      .forEach((t) => pc.addTrack(t, localStreamRef.current!));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("offer", { roomId, from: userId, offer, video });

    setInCall(true);
    attachLocal();
  };

  const acceptCall = async () => {
    if (!roomId || !userId || !incomingCall) return;
    const pc = createPeer();
    try {
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({
        video: incomingCall.hasVideo,
        audio: true,
      });
    } catch (err) {
      console.error("getUserMedia failed on accept", err);
      return;
    }
    localStreamRef.current
      .getTracks()
      .forEach((t) => pc.addTrack(t, localStreamRef.current!));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("answer", { roomId, from: userId, answer });

    setInCall(true);
    setIncomingCall(null);
    attachLocal();
    attachRemote();
  };

  const rejectCall = () => {
    setIncomingCall(null);
    stopLocal();
    cleanupPeer();
  };

  const toggleMuteAudio = () => {
    localStreamRef.current
      ?.getAudioTracks()
      .forEach((t) => (t.enabled = !t.enabled));
    setIsAudioMuted((p) => !p);
  };
  const toggleMuteVideo = () => {
    localStreamRef.current
      ?.getVideoTracks()
      .forEach((t) => (t.enabled = !t.enabled));
    setIsVideoMuted((p) => !p);
  };

  return {
    inCall,
    incomingCall,
    isAudioMuted,
    isVideoMuted,
    localVideoRef,
    remoteVideoRef,
    remoteAudioRef,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMuteAudio,
    toggleMuteVideo,
  };
}
