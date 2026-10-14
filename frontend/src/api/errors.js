export function getApiErrorMessage(error, fallback) {
  const responseMessage = error?.response?.data?.message;
  if (typeof responseMessage === "string" && responseMessage.trim()) {
    return responseMessage;
  }

  if (error?.request || error?.code === "ERR_NETWORK") {
    return "Unable to reach the server. Check your connection and try again.";
  }

  if (typeof error?.message === "string" && error.message.trim()) {
    return error.message;
  }

  const status = error?.response?.status;
  if (status) return `Request failed (HTTP ${status}). Please try again.`;

  return fallback;
}
