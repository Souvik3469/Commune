import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(import.meta.env.VITE_API_BASE_URL, {
      autoConnect: false,
      withCredentials: true,
      transports: ["websocket"],
    });
  }
  return socket;
};
