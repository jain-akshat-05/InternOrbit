import axios from "axios";
import { clearStoredUser, readStoredUser } from "../authStorage";

const apiBaseUrl =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:5000/api" : "");

if (!apiBaseUrl) {
  throw new Error("VITE_API_URL must be configured for production.");
}

const api = axios.create({
  baseURL: apiBaseUrl,
});

let unauthorizedHandler = null;

export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

const isAuthAttempt = (url = "") =>
  url.includes("/auth/login") || url.includes("/auth/register");

api.interceptors.request.use((config) => {
  const user = readStoredUser();
  if (user?.token) config.headers.Authorization = `Bearer ${user.token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url || "";
    if (status === 401 && !isAuthAttempt(requestUrl) && readStoredUser()) {
      clearStoredUser();
      unauthorizedHandler?.();
    }
    return Promise.reject(error);
  }
);

export default api;
