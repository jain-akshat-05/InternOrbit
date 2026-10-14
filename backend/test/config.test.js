const assert = require("node:assert/strict");
const test = require("node:test");
const { loadConfig } = require("../config/env");

const validEnv = () => ({
  MONGO_URI: "mongodb://localhost:27017/internorbit",
  JWT_SECRET: "test-secret-that-is-long-enough-for-validation",
  PORT: "5001",
  CLIENT_URL: "http://localhost:5173/",
});

test("requires database and JWT configuration", () => {
  assert.throws(() => loadConfig({}), /MONGO_URI, JWT_SECRET/);
});

test("rejects a short JWT secret", () => {
  assert.throws(
    () => loadConfig({ ...validEnv(), JWT_SECRET: "too-short" }),
    /at least 32 characters/
  );
});

test("normalizes the client origin and port", () => {
  assert.deepEqual(loadConfig(validEnv()), {
    mongoUri: "mongodb://localhost:27017/internorbit",
    jwtSecret: "test-secret-that-is-long-enough-for-validation",
    port: 5001,
    clientUrl: "http://localhost:5173",
    resumeMaxBytes: 5 * 1024 * 1024,
    resumeStorageProvider: "local",
    resumeStorageDisabled: false,
    resumeS3: null,
    resumeStorageDir: require("node:path").resolve(__dirname, "..", "storage", "resumes"),
  });
});

test("rejects an invalid port or client URL", () => {
  assert.throws(() => loadConfig({ ...validEnv(), PORT: "70000" }), /PORT/);
  assert.throws(
    () => loadConfig({ ...validEnv(), CLIENT_URL: "not-a-url" }),
    /CLIENT_URL/
  );
});

test("requires a deployed HTTPS client origin in production", () => {
  assert.throws(
    () => loadConfig({ ...validEnv(), NODE_ENV: "production", CLIENT_URL: undefined }),
    /CLIENT_URL is required in production/
  );
  assert.throws(
    () => loadConfig({ ...validEnv(), NODE_ENV: "production", CLIENT_URL: "http://localhost:5173" }),
    /public HTTPS URL/
  );
  assert.throws(
    () => loadConfig({ ...validEnv(), NODE_ENV: "production", CLIENT_URL: "https://localhost:5173" }),
    /public HTTPS URL/
  );
  assert.equal(
    loadConfig({
      ...validEnv(),
      NODE_ENV: "production",
      CLIENT_URL: "https://internorbit-mu.vercel.app",
      RESUME_STORAGE_PROVIDER: "s3",
      RESUME_S3_BUCKET: "test-resumes",
      RESUME_S3_REGION: "us-east-1",
      RESUME_S3_ACCESS_KEY_ID: "test-access-key",
      RESUME_S3_SECRET_ACCESS_KEY: "test-secret-key",
    }).clientUrl,
    "https://internorbit-mu.vercel.app"
  );
});

test("requires configured S3 storage for production", () => {
  const productionEnv = { ...validEnv(), NODE_ENV: "production", CLIENT_URL: "https://internorbit-mu.vercel.app" };
  assert.throws(() => loadConfig(productionEnv), /RESUME_STORAGE_PROVIDER must be "s3"/);
  assert.throws(() => loadConfig({ ...productionEnv, RESUME_STORAGE_PROVIDER: "s3" }), /Missing required S3 resume storage variables/);
  const configured = loadConfig({
    ...productionEnv,
    RESUME_STORAGE_PROVIDER: "s3",
    RESUME_S3_BUCKET: "test-resumes",
    RESUME_S3_REGION: "us-east-1",
    RESUME_S3_ACCESS_KEY_ID: "test-access-key",
    RESUME_S3_SECRET_ACCESS_KEY: "test-secret-key",
  });
  assert.equal(configured.resumeStorageProvider, "s3");
  assert.equal(configured.resumeS3.bucket, "test-resumes");
  assert.equal(configured.resumeS3.forcePathStyle, false);
});

test("permits explicit resume-disabled production mode without S3 credentials", () => {
  const config = loadConfig({
    ...validEnv(),
    NODE_ENV: "production",
    CLIENT_URL: "https://internorbit-mu.vercel.app",
    RESUME_STORAGE_DISABLED: "true",
  });
  assert.equal(config.resumeStorageDisabled, true);
  assert.equal(config.resumeStorageProvider, "disabled");
  assert.equal(config.resumeS3, null);
  assert.throws(
    () => loadConfig({ ...validEnv(), NODE_ENV: "production", CLIENT_URL: "https://internorbit-mu.vercel.app", RESUME_STORAGE_DISABLED: "maybe" }),
    /RESUME_STORAGE_DISABLED must be true or false/
  );
});

test("validates resume upload size configuration", () => {
  assert.throws(() => loadConfig({ ...validEnv(), RESUME_MAX_BYTES: "512" }), /RESUME_MAX_BYTES/);
  assert.equal(loadConfig({ ...validEnv(), RESUME_MAX_BYTES: "1048576" }).resumeMaxBytes, 1048576);
});
