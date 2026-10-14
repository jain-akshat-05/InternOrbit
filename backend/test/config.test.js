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
      CLIENT_URL: "https://intern-orbit-flax.vercel.app",
    }).clientUrl,
    "https://intern-orbit-flax.vercel.app"
  );
});

test("validates resume upload size configuration", () => {
  assert.throws(() => loadConfig({ ...validEnv(), RESUME_MAX_BYTES: "512" }), /RESUME_MAX_BYTES/);
  assert.equal(loadConfig({ ...validEnv(), RESUME_MAX_BYTES: "1048576" }).resumeMaxBytes, 1048576);
});