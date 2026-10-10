const assert = require("node:assert/strict");
const test = require("node:test");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { authorize, protect } = require("../middleware/auth");

const secret = "test-secret-that-is-long-enough-for-validation";
const userId = "507f1f77bcf86cd799439011";

const createResponse = () => ({
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test("protect rejects missing, invalid, and expired JWTs", async () => {
  process.env.JWT_SECRET = secret;
  const response = createResponse();
  let nextCalled = false;

  await protect({ headers: {} }, response, () => {
    nextCalled = true;
  });

  assert.equal(response.statusCode, 401);
  assert.equal(nextCalled, false);

  const invalidResponse = createResponse();
  await protect(
    { headers: { authorization: "Bearer invalid" } },
    invalidResponse,
    () => {}
  );
  assert.equal(invalidResponse.statusCode, 401);

  const expiredToken = jwt.sign({ id: userId }, secret, { expiresIn: -1 });
  const expiredResponse = createResponse();
  await protect(
    { headers: { authorization: `Bearer ${expiredToken}` } },
    expiredResponse,
    () => {}
  );
  assert.equal(expiredResponse.statusCode, 401);
});

test("protect loads the current user and authorize enforces its database role", async () => {
  const originalFindById = User.findById;
  process.env.JWT_SECRET = secret;
  User.findById = (id) => ({
    select: async () => ({ _id: id, role: "student" }),
  });

  try {
    const token = jwt.sign({ id: userId, role: "admin" }, secret);
    const request = { headers: { authorization: `Bearer ${token}` } };
    const response = createResponse();
    let nextCalled = false;

    await protect(request, response, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(request.user.role, "student");

    const forbiddenResponse = createResponse();
    authorize("admin")(request, forbiddenResponse, () => {});
    assert.equal(forbiddenResponse.statusCode, 403);
  } finally {
    User.findById = originalFindById;
  }
});