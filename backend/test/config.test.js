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
  });
});

test("rejects an invalid port or client URL", () => {
  assert.throws(() => loadConfig({ ...validEnv(), PORT: "70000" }), /PORT/);
  assert.throws(
    () => loadConfig({ ...validEnv(), CLIENT_URL: "not-a-url" }),
    /CLIENT_URL/
  );
});