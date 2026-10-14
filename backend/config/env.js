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

  const resumeStorageDisabledValue = env.RESUME_STORAGE_DISABLED?.trim().toLowerCase();
  if (resumeStorageDisabledValue && !["true", "false"].includes(resumeStorageDisabledValue)) {
    throw new Error("RESUME_STORAGE_DISABLED must be true or false");
  }
  const resumeStorageDisabled = resumeStorageDisabledValue === "true";
  const resumeStorageProvider = resumeStorageDisabled
    ? "disabled"
    : (env.RESUME_STORAGE_PROVIDER || "local").trim().toLowerCase();
  if (!resumeStorageDisabled && !["local", "s3"].includes(resumeStorageProvider)) {
    throw new Error('RESUME_STORAGE_PROVIDER must be "local" or "s3"');
  }
  if (env.NODE_ENV === "production" && !resumeStorageDisabled && resumeStorageProvider !== "s3") {
    throw new Error('RESUME_STORAGE_PROVIDER must be "s3" in production');
  }

  let resumeS3 = null;
  if (resumeStorageProvider === "s3") {
    const s3Variables = [
      "RESUME_S3_BUCKET",
      "RESUME_S3_REGION",
      "RESUME_S3_ACCESS_KEY_ID",
      "RESUME_S3_SECRET_ACCESS_KEY",
    ];
    const missingS3Variables = s3Variables.filter((key) => !env[key] || !env[key].trim());
    if (missingS3Variables.length) {
      throw new Error(`Missing required S3 resume storage variables: ${missingS3Variables.join(", ")}`);
    }

    let endpoint;
    if (env.RESUME_S3_ENDPOINT?.trim()) {
      try {
        const parsedEndpoint = new URL(env.RESUME_S3_ENDPOINT.trim());
        if (!["http:", "https:"].includes(parsedEndpoint.protocol) || parsedEndpoint.username || parsedEndpoint.password) {
          throw new Error();
        }
        if (env.NODE_ENV === "production" && parsedEndpoint.protocol !== "https:") {
          throw new Error();
        }
        endpoint = parsedEndpoint.origin + parsedEndpoint.pathname.replace(/\/+$/, "");
      } catch {
        throw new Error("RESUME_S3_ENDPOINT must be a valid HTTPS URL in production");
      }
    }

    const forcePathStyleValue = env.RESUME_S3_FORCE_PATH_STYLE?.trim().toLowerCase();
    if (forcePathStyleValue && !["true", "false"].includes(forcePathStyleValue)) {
      throw new Error("RESUME_S3_FORCE_PATH_STYLE must be true or false");
    }

    resumeS3 = {
      bucket: env.RESUME_S3_BUCKET.trim(),
      region: env.RESUME_S3_REGION.trim(),
      accessKeyId: env.RESUME_S3_ACCESS_KEY_ID.trim(),
      secretAccessKey: env.RESUME_S3_SECRET_ACCESS_KEY,
      ...(endpoint ? { endpoint } : {}),
      forcePathStyle: forcePathStyleValue
        ? forcePathStyleValue === "true"
        : Boolean(endpoint),
    };
  }

  return {
    mongoUri: env.MONGO_URI.trim(),
    jwtSecret,
    port,
    clientUrl: clientOrigin,
    resumeMaxBytes,
    resumeStorageProvider,
    resumeStorageDisabled,
    resumeS3,
    resumeStorageDir: path.resolve(
      env.RESUME_STORAGE_DIR || path.join(__dirname, "..", "storage", "resumes")
    ),
  };
};

module.exports = { loadConfig };
