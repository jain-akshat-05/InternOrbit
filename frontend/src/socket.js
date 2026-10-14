import { io } from "socket.io-client";

const socketUrl =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.DEV ? "http://localhost:5000" : "");

if (!socketUrl) {
  throw new Error("VITE_SOCKET_URL must be configured for production.");
}

const socket = io(socketUrl, {
  autoConnect: false,
});

export default socket;
