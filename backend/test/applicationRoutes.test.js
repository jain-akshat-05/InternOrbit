const assert = require("node:assert/strict");
const test = require("node:test");
const Application = require("../models/Application");
const Internship = require("../models/Internship");
const router = require("../routes/applicationRoutes");

const route = router.stack.find(
  (layer) => layer.route?.path === "/" && layer.route.methods.post
);
const handler = route.route.stack.at(-1).handle;
const receivedRoute = router.stack.find(
  (layer) => layer.route?.path === "/received" && layer.route.methods.get
);
const receivedHandler = receivedRoute.route.stack.at(-1).handle;

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

test("students cannot apply to archived internships", async () => {
  const originalFindById = Internship.findById;
  const originalCreate = Application.create;
  let created = false;
  Internship.findById = async () => ({
    _id: "507f1f77bcf86cd799439011",
    isActive: false,
  });
  Application.create = async () => {
    created = true;
  };

  try {
    const response = createResponse();
    await handler(
      {
        body: { internshipId: "507f1f77bcf86cd799439011" },
        user: { _id: "507f1f77bcf86cd799439012" },
      },
      response
    );

    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.body, { message: "Internship not found" });
    assert.equal(created, false);
  } finally {
    Internship.findById = originalFindById;
    Application.create = originalCreate;
  }
});

test("received-application database errors do not expose internal details", async () => {
  const originalFind = Application.find;
  const originalError = console.error;
  Application.find = () => {
    throw new Error("private database detail");
  };
  console.error = () => {};

  try {
    const response = createResponse();
    await receivedHandler({ user: { _id: "507f1f77bcf86cd799439012" } }, response);
    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.body, { message: "Internal server error" });
  } finally {
    Application.find = originalFind;
    console.error = originalError;
  }
});