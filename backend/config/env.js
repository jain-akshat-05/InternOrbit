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

  const clientUrl = (env.CLIENT_URL || "http://localhost:5173").trim();
  let clientOrigin;
  try {
    const parsedUrl = new URL(clientUrl);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error();
    }
    clientOrigin = parsedUrl.origin;
  } catch {
    throw new Error("CLIENT_URL must be a valid HTTP or HTTPS URL");
  }

  return {
    mongoUri: env.MONGO_URI.trim(),
    jwtSecret,
    port,
    clientUrl: clientOrigin,
  };
};

module.exports = { loadConfig };