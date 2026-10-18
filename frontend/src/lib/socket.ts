import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

/**
 * One socket for the whole app. The server authenticates the handshake with
 * the same JWT the HTTP routes use and joins this connection to a room per
 * conversation, so messages, typing and call signalling all arrive here.
 *
 * Previously every chat row, the chat area and the composer each opened their
 * own Ably connection with a root API key read from the bundle — one WebSocket
 * per visible chat, and a publishable key handed to anyone who viewed source.
 */
export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(import.meta.env.VITE_API_BASE_URL, {
      autoConnect: false,
      withCredentials: true,
      transports: ["websocket"],
      auth: (cb) => cb({ token: localStorage.getItem("accessToken") }),
    });
  }
  return socket;
};

/** Connect (or reconnect) with the current token. */
export const connectSocket = (): Socket => {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
};

export const disconnectSocket = (): void => {
  if (socket?.connected) socket.disconnect();
};
