const path = require("node:path");

const loadConfig = (env = process.env) => {
  const missing = ["MONGO_URI", "JWT_SECRET"].filter(
    (key) => !env[key] || !env[key].trim()
  );
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  const jwtSecret = env.JWT_SECRET;
  if (jwtSecret.trim().length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long");
  }

  const port = env.PORT === undefined ? 5000 : Number(env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  const clientUrlValue = env.CLIENT_URL?.trim();
  if (env.NODE_ENV === "production" && !clientUrlValue) {
    throw new Error("CLIENT_URL is required in production");
  }
  const clientUrl = clientUrlValue || "http://localhost:5173";
  let clientOrigin;
  try {
    const parsedUrl = new URL(clientUrl);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error();
    }
    if (
      env.NODE_ENV === "production" &&
      (parsedUrl.protocol !== "https:" ||
        ["localhost", "127.0.0.1", "[::1]"].includes(parsedUrl.hostname))
    ) {
      throw new Error();
    }
    clientOrigin = parsedUrl.origin;
  } catch {
    throw new Error("CLIENT_URL must be a public HTTPS URL in production or a valid HTTP(S) URL in development");
  }

  const resumeMaxBytes = env.RESUME_MAX_BYTES === undefined ? 5 * 1024 * 1024 : Number(env.RESUME_MAX_BYTES);
  if (!Number.isInteger(resumeMaxBytes) || resumeMaxBytes < 1024 || resumeMaxBytes > 20 * 1024 * 1024) {
    throw new Error("RESUME_MAX_BYTES must be an integer between 1024 and 20971520");
  }

  return {
    mongoUri: env.MONGO_URI.trim(),
    jwtSecret,
    port,
    clientUrl: clientOrigin,
    resumeMaxBytes,
    resumeStorageDir: path.resolve(
      env.RESUME_STORAGE_DIR || path.join(__dirname, "..", "storage", "resumes")
    ),
  };
};

module.exports = { loadConfig };