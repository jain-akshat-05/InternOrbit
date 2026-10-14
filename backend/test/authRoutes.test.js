const assert = require("node:assert/strict");
const test = require("node:test");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const router = require("../routes/authRoutes");

const findHandler = (method, path) => {
  const route = router.stack.find(
    (layer) => layer.route?.path === path && layer.route.methods[method]
  );
  return route.route.stack.at(-1).handle;
};

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

const withJwtSecret = async (run) => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-validation";
  try {
    await run();
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
};

test("registers a student using the frontend request shape and returns an authenticated user", async () => {
  const originalFindOne = User.findOne;
  const originalCreate = User.create;
  let createdUser;
  User.findOne = async () => null;
  User.create = async (userData) => {
    createdUser = userData;
    return {
      ...userData,
      _id: "507f1f77bcf86cd799439011",
    };
  };

  try {
    await withJwtSecret(async () => {
      const response = createResponse();
      await findHandler("post", "/register")(
        {
          body: {
            name: " Test Student ",
            email: " STUDENT@example.com ",
            password: "safe-password",
            role: "student",
            company: "",
          },
        },
        response
      );

      assert.equal(response.statusCode, 201);
      assert.deepEqual(createdUser, {
        name: "Test Student",
        email: "student@example.com",
        password: "safe-password",
        role: "student",
        company: "",
      });
      assert.deepEqual(
        { _id: response.body._id, name: response.body.name, email: response.body.email, role: response.body.role },
        {
          _id: "507f1f77bcf86cd799439011",
          name: "Test Student",
          email: "student@example.com",
          role: "student",
        }
      );
      assert.equal(jwt.verify(response.body.token, process.env.JWT_SECRET).id, response.body._id);
    });
  } finally {
    User.findOne = originalFindOne;
    User.create = originalCreate;
  }
});

test("logs in with the frontend request shape and rejects an incorrect password", async () => {
  const originalFindOne = User.findOne;
  User.findOne = async () => ({
    _id: "507f1f77bcf86cd799439011",
    name: "Test Student",
    email: "student@example.com",
    role: "student",
    async comparePassword(password) {
      return password === "safe-password";
    },
  });

  try {
    await withJwtSecret(async () => {
      const response = createResponse();
      await findHandler("post", "/login")(
        { body: { email: "STUDENT@example.com", password: "safe-password" } },
        response
      );

      assert.equal(response.statusCode, undefined);
      assert.equal(response.body.email, "student@example.com");
      assert.equal(jwt.verify(response.body.token, process.env.JWT_SECRET).id, response.body._id);

      const rejected = createResponse();
      await findHandler("post", "/login")(
        { body: { email: "student@example.com", password: "wrong-password" } },
        rejected
      );
      assert.equal(rejected.statusCode, 401);
      assert.deepEqual(rejected.body, { message: "Invalid email or password" });
    });
  } finally {
    User.findOne = originalFindOne;
  }
});
