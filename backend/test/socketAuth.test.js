const assert = require("node:assert/strict");
const test = require("node:test");
const jwt = require("jsonwebtoken");
const createSocketAuth = require("../middleware/socketAuth");

const secret = "test-secret-that-is-long-enough-for-validation";

const authenticate = (auth) => {
  const socket = { handshake: { auth }, data: {} };
  let error;
  createSocketAuth(secret)(socket, (value) => {
    error = value;
  });
  return { socket, error };
};

test("binds the socket room identity to the verified token", () => {
  const token = jwt.sign({ id: "student-id" }, secret);
  const { socket, error } = authenticate({ token, userId: "other-user" });

  assert.equal(error, undefined);
  assert.equal(socket.data.userId, "student-id");
});

test("rejects missing, invalid, and expired socket tokens", () => {
  assert.ok(authenticate(undefined).error);
  assert.ok(authenticate({ token: "invalid" }).error);

  const expiredToken = jwt.sign({ id: "student-id" }, secret, { expiresIn: -1 });
  assert.ok(authenticate({ token: expiredToken }).error);
});