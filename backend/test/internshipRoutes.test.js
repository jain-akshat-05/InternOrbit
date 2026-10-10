const assert = require("node:assert/strict");
const test = require("node:test");
const router = require("../routes/internshipRoutes");
const Internship = require("../models/Internship");

const internshipId = "507f1f77bcf86cd799439011";
const recruiterId = "507f1f77bcf86cd799439012";

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

test("registers the recruiter postings route before the internship ID route", () => {
  const getRoutes = router.stack
    .filter((layer) => layer.route && layer.route.methods.get)
    .map((layer) => layer.route.path);

  assert.ok(getRoutes.indexOf("/recruiter/mine") < getRoutes.indexOf("/:id"));
});

test("public internship browsing filters to active postings", async () => {
  const originalFind = Internship.find;
  let appliedFilter;
  Internship.find = (filter) => {
    appliedFilter = filter;
    return {
      populate() {
        return this;
      },
      sort: async () => [],
    };
  };

  try {
    await findHandler("get", "/")({ query: {} }, createResponse());
    assert.deepEqual(appliedFilter, { isActive: true });
  } finally {
    Internship.find = originalFind;
  }
});

test("public detail lookup hides archived postings", async () => {
  const originalFindById = Internship.findById;
  Internship.findById = () => ({
    populate: async () => ({ _id: internshipId, isActive: false }),
  });

  try {
    const response = createResponse();
    await findHandler("get", "/:id")({ params: { id: internshipId } }, response);
    assert.equal(response.statusCode, 404);
  } finally {
    Internship.findById = originalFindById;
  }
});

test("deleting a posting deactivates its document instead of deleting it", async () => {
  const originalFindById = Internship.findById;
  let saved = false;
  const internship = {
    _id: internshipId,
    postedBy: { toString: () => recruiterId },
    isActive: true,
    async save() {
      saved = true;
    },
    async deleteOne() {
      throw new Error("Archive must not delete the internship document");
    },
  };
  Internship.findById = async () => internship;

  try {
    const response = createResponse();
    await findHandler("delete", "/:id")(
      { params: { id: internshipId }, user: { _id: recruiterId, role: "recruiter" } },
      response
    );

    assert.equal(response.statusCode, undefined);
    assert.equal(internship.isActive, false);
    assert.equal(saved, true);
    assert.deepEqual(response.body, { message: "Internship archived" });
  } finally {
    Internship.findById = originalFindById;
  }
});

test("only the posting owner or an admin can archive it", async () => {
  const originalFindById = Internship.findById;
  let saved = false;
  Internship.findById = async () => ({
    _id: internshipId,
    postedBy: { toString: () => recruiterId },
    isActive: true,
    async save() {
      saved = true;
    },
  });

  try {
    const response = createResponse();
    await findHandler("delete", "/:id")(
      { params: { id: internshipId }, user: { _id: "507f1f77bcf86cd799439013", role: "recruiter" } },
      response
    );

    assert.equal(response.statusCode, 403);
    assert.equal(saved, false);
  } finally {
    Internship.findById = originalFindById;
  }
});