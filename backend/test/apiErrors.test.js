const assert = require("node:assert/strict");
const test = require("node:test");
const { isValidObjectId, sendApiError } = require("../utils/apiErrors");

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

test("accepts only valid MongoDB object ID strings", () => {
  assert.equal(isValidObjectId("507f1f77bcf86cd799439011"), true);
  assert.equal(isValidObjectId("not-an-id"), false);
  assert.equal(isValidObjectId(123), false);
});

test("maps database validation and duplicate errors to safe client responses", () => {
  const duplicateResponse = createResponse();
  sendApiError(duplicateResponse, { code: 11000, message: "private database detail" });
  assert.equal(duplicateResponse.statusCode, 409);
  assert.doesNotMatch(JSON.stringify(duplicateResponse.body), /private database detail/);

  const validationResponse = createResponse();
  sendApiError(validationResponse, { name: "ValidationError" });
  assert.equal(validationResponse.statusCode, 400);
});

test("maps malformed JSON request bodies to a client error", () => {
  const response = createResponse();
  sendApiError(response, { type: "entity.parse.failed", message: "private parser detail" });
  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, { message: "Invalid JSON request body" });
});

test("does not expose unexpected server error details", () => {
  const response = createResponse();
  const originalError = console.error;
  console.error = () => {};
  try {
    sendApiError(response, { name: "MongoError", message: "private database detail" });
  } finally {
    console.error = originalError;
  }

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { message: "Internal server error" });
});