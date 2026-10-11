const assert = require("node:assert/strict");
const test = require("node:test");
const Notification = require("../models/Notification");
const router = require("../routes/notificationRoutes");

const routeHandler = (method, routePath) => {
  const route = router.stack.find((layer) => layer.route?.path === routePath && layer.route.methods[method]);
  return route.route.stack.at(-1).handle;
};

const createResponse = () => ({
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test("notification listing always scopes records to the authenticated user", async () => {
  const originalFind = Notification.find;
  let filter;
  Notification.find = (query) => {
    filter = query;
    return { sort() { return this; }, limit: async () => [] };
  };

  try {
    const res = createResponse();
    await routeHandler("get", "/")({ user: { _id: "507f1f77bcf86cd799439011" }, query: { user: "507f1f77bcf86cd799439012" } }, res);
    assert.deepEqual(filter, { user: "507f1f77bcf86cd799439011" });
    assert.deepEqual(res.body, []);
  } finally {
    Notification.find = originalFind;
  }
});

test("notification read updates are owner-scoped", async () => {
  const originalUpdate = Notification.findOneAndUpdate;
  let filter;
  Notification.findOneAndUpdate = async (query) => {
    filter = query;
    return null;
  };

  try {
    const res = createResponse();
    await routeHandler("patch", "/:id/read")(
      { params: { id: "507f1f77bcf86cd799439013" }, user: { _id: "507f1f77bcf86cd799439011" } },
      res
    );
    assert.deepEqual(filter, { _id: "507f1f77bcf86cd799439013", user: "507f1f77bcf86cd799439011" });
    assert.equal(res.statusCode, 404);
  } finally {
    Notification.findOneAndUpdate = originalUpdate;
  }
});