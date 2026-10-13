const assert = require("node:assert/strict");
const test = require("node:test");
const Application = require("../models/Application");
const Internship = require("../models/Internship");
const Resume = require("../models/Resume");
const RoundAssignment = require("../models/RoundAssignment");
const path = require("node:path");
const createApplicationRoutes = require("../routes/applicationRoutes");
const router = createApplicationRoutes({ resumeStorageDir: path.resolve(__dirname, "..", "storage", "resumes") });

const route = router.stack.find(
  (layer) => layer.route?.path === "/" && layer.route.methods.post
);
const handler = route.route.stack.at(-1).handle;
const receivedRoute = router.stack.find(
  (layer) => layer.route?.path === "/received" && layer.route.methods.get
);
const receivedHandler = receivedRoute.route.stack.at(-1).handle;
const receivedSummaryRoute = router.stack.find(
  (layer) => layer.route?.path === "/received/summary" && layer.route.methods.get
);
const receivedSummaryHandler = receivedSummaryRoute.route.stack.at(-1).handle;
const statusRoute = router.stack.find(
  (layer) => layer.route?.path === "/:id/status" && layer.route.methods.put
);
const statusHandler = statusRoute.route.stack.at(-1).handle;
const detailRoute = router.stack.find(
  (layer) => layer.route?.path === "/:id" && layer.route.methods.get
);
const detailHandler = detailRoute.route.stack.at(-1).handle;

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

test("received application summary counts every recruiter-owned application beyond the list limit", async () => {
  const originalAggregate = Application.aggregate;
  const recruiterId = "507f1f77bcf86cd799439012";
  let pipeline;
  Application.aggregate = async (stages) => {
    pipeline = stages;
    return [
      { _id: "applied", count: 201 },
      { _id: "interview", count: 24 },
      { _id: "rejected", count: 13 },
    ];
  };

  try {
    const response = createResponse();
    await receivedSummaryHandler({ user: { _id: recruiterId } }, response);

    assert.deepEqual(pipeline, [
      { $match: { recruiter: recruiterId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    assert.equal(pipeline.some((stage) => "$limit" in stage), false);
    assert.deepEqual(response.body, {
      totalApplications: 238,
      statusBreakdown: [
        { _id: "applied", count: 201 },
        { _id: "interview", count: 24 },
        { _id: "rejected", count: 13 },
      ],
    });
  } finally {
    Application.aggregate = originalAggregate;
  }
});

test("received application summary is role-protected and scoped to the authenticated recruiter", async () => {
  const authLayers = receivedSummaryRoute.route.stack;
  const response = createResponse();
  let nextCalled = false;
  authLayers[1].handle(
    { user: { _id: "507f1f77bcf86cd799439013", role: "student" } },
    response,
    () => { nextCalled = true; }
  );

  assert.equal(response.statusCode, 403);
  assert.equal(nextCalled, false);

  const originalAggregate = Application.aggregate;
  let matchedRecruiter;
  Application.aggregate = async ([matchStage]) => {
    matchedRecruiter = matchStage.$match.recruiter;
    return [];
  };

  try {
    const recruiterId = "507f1f77bcf86cd799439012";
    await receivedSummaryHandler({ user: { _id: recruiterId } }, createResponse());
    assert.equal(matchedRecruiter, recruiterId);
  } finally {
    Application.aggregate = originalAggregate;
  }
});

test("application submission requires a student-owned resume", async () => {
  const originalFindById = Internship.findById;
  const originalCreate = Application.create;
  let created = false;
  Internship.findById = async () => ({ _id: "507f1f77bcf86cd799439011", isActive: true, applicationQuestions: [] });
  Application.create = async () => { created = true; };

  try {
    const response = createResponse();
    await handler({ body: { internshipId: "507f1f77bcf86cd799439011" }, user: { _id: "507f1f77bcf86cd799439012" } }, response);
    assert.equal(response.statusCode, 400);
    assert.equal(created, false);
  } finally {
    Internship.findById = originalFindById;
    Application.create = originalCreate;
  }
});

test("application submission requires answers to configured questions", async () => {
  const originalFindById = Internship.findById;
  const originalResumeFind = Resume.findOne;
  const originalCreate = Application.create;
  let created = false;
  Internship.findById = async () => ({
    _id: "507f1f77bcf86cd799439011",
    isActive: true,
    applicationQuestions: ["Why this role?"],
  });
  Resume.findOne = () => ({ select: async () => ({ _id: "507f1f77bcf86cd799439013" }) });
  Application.create = async () => { created = true; };

  try {
    const response = createResponse();
    await handler({
      body: { internshipId: "507f1f77bcf86cd799439011", resumeId: "507f1f77bcf86cd799439013" },
      user: { _id: "507f1f77bcf86cd799439012" },
    }, response);
    assert.equal(response.statusCode, 400);
    assert.equal(created, false);
  } finally {
    Internship.findById = originalFindById;
    Resume.findOne = originalResumeFind;
    Application.create = originalCreate;
  }
});

test("terminal application states cannot transition backward", async () => {
  const originalFindById = Application.findById;
  let saved = false;
  Application.findById = async () => ({
    _id: "507f1f77bcf86cd799439014",
    status: "selected",
    recruiter: { toString: () => "507f1f77bcf86cd799439012" },
    statusHistory: [],
    async save() { saved = true; },
  });

  try {
    const response = createResponse();
    await statusHandler({
      params: { id: "507f1f77bcf86cd799439014" },
      body: { status: "rejected" },
      user: { _id: "507f1f77bcf86cd799439012", role: "recruiter" },
    }, response);
    assert.equal(response.statusCode, 409);
    assert.equal(saved, false);
  } finally {
    Application.findById = originalFindById;
  }
});

test("students see published round schedules but not private feedback or unpublished results", async () => {
  const originalFindById = Application.findById;
  const originalRoundFind = RoundAssignment.find;
  const application = {
    _id: "507f1f77bcf86cd799439014",
    student: { _id: "507f1f77bcf86cd799439012" },
    recruiter: "507f1f77bcf86cd799439013",
    internship: { title: "Developer internship" },
    toObject() { return { _id: this._id }; },
  };
  Application.findById = () => ({ populate() { return this; }, then(resolve) { resolve(application); } });
  RoundAssignment.find = () => ({
    populate() { return this; },
    sort: async () => [{
      _id: "507f1f77bcf86cd799439015",
      round: { _id: "507f1f77bcf86cd799439016", title: "Technical interview", published: true },
      outcome: "passed",
      resultPublished: false,
      privateFeedback: "Private interviewer notes",
    }],
  });

  try {
    const res = createResponse();
    await detailHandler(
      { params: { id: application._id }, user: { _id: application.student._id, role: "student" } },
      res
    );
    assert.equal(res.body.rounds.length, 1);
    assert.equal(res.body.rounds[0].outcome, null);
    assert.equal("privateFeedback" in res.body.rounds[0], false);
  } finally {
    Application.findById = originalFindById;
    RoundAssignment.find = originalRoundFind;
  }
});