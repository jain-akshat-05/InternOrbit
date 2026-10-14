import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const validateProductionUrls = (env) => {
  const apiUrl = env.VITE_API_URL;
  const socketUrl = env.VITE_SOCKET_URL;
  const checkHttpsOrigin = (value, variableName) => {
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error(`${variableName} must be a valid HTTPS URL.`);
    }
    if (parsed.protocol !== "https:" || ["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname)) {
      throw new Error(`${variableName} must use the deployed HTTPS backend host.`);
    }
    return parsed;
  };

  if (!apiUrl) throw new Error("VITE_API_URL is required for production builds.");
  if (!socketUrl) throw new Error("VITE_SOCKET_URL is required for production builds.");

  const api = checkHttpsOrigin(apiUrl, "VITE_API_URL");
  if (api.pathname.replace(/\/+$/, "") !== "/api" || api.search || api.hash) {
    throw new Error("VITE_API_URL must point to the backend HTTPS URL ending in /api.");
  }

  const socket = checkHttpsOrigin(socketUrl, "VITE_SOCKET_URL");
  if (socket.pathname !== "/" || socket.search || socket.hash) {
    throw new Error("VITE_SOCKET_URL must be the backend HTTPS origin without a path.");
  }
};

export default defineConfig(({ mode }) => {
  if (mode === "production") {
    validateProductionUrls(loadEnv(mode, process.cwd(), "VITE_"));
  }

  return {
    plugins: [react()],
    server: { port: 5173 },
  };
});
