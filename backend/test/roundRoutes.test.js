const assert = require("node:assert/strict");
const test = require("node:test");
const Application = require("../models/Application");
const HiringRound = require("../models/HiringRound");
const Internship = require("../models/Internship");
const RoundAssignment = require("../models/RoundAssignment");
const router = require("../routes/roundRoutes");

const internshipId = "507f1f77bcf86cd799439011";
const roundId = "507f1f77bcf86cd799439012";
const ownerId = "507f1f77bcf86cd799439013";

const getHandler = (method, routePath) => {
  const layer = router.stack.find((item) => item.route?.path === routePath && item.route.methods[method]);
  return layer.route.stack.at(-1).handle;
};

const response = () => ({
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test("round listing denies a recruiter who does not own the internship", async () => {
  const originalFindById = Internship.findById;
  const originalRoundFind = HiringRound.find;
  let queriedRounds = false;
  Internship.findById = async () => ({ _id: internshipId, postedBy: { toString: () => ownerId } });
  HiringRound.find = () => { queriedRounds = true; return []; };

  try {
    const res = response();
    await getHandler("get", "/internship/:internshipId")(
      { params: { internshipId }, user: { _id: "507f1f77bcf86cd799439014", role: "recruiter" } },
      res
    );
    assert.equal(res.statusCode, 403);
    assert.equal(queriedRounds, false);
  } finally {
    Internship.findById = originalFindById;
    HiringRound.find = originalRoundFind;
  }
});

test("candidate assignment rejects applications from another internship", async () => {
  const originalRoundFind = HiringRound.findById;
  const originalInternshipFind = Internship.findById;
  const originalApplicationFind = Application.find;
  let assignmentsQueried = false;
  HiringRound.findById = async () => ({ _id: roundId, internship: internshipId });
  Internship.findById = async () => ({ _id: internshipId, postedBy: { toString: () => ownerId } });
  Application.find = () => ({ select: async () => [] });
  const originalAssignmentUpdate = RoundAssignment.findOneAndUpdate;
  RoundAssignment.findOneAndUpdate = async () => { assignmentsQueried = true; };

  try {
    const res = response();
    await getHandler("post", "/:id/assign")(
      {
        params: { id: roundId },
        body: { applicationIds: ["507f1f77bcf86cd799439015"] },
        user: { _id: ownerId, role: "recruiter" },
      },
      res
    );
    assert.equal(res.statusCode, 400);
    assert.equal(assignmentsQueried, false);
  } finally {
    HiringRound.findById = originalRoundFind;
    Internship.findById = originalInternshipFind;
    Application.find = originalApplicationFind;
    RoundAssignment.findOneAndUpdate = originalAssignmentUpdate;
  }
});

test("rounds with candidate history cannot be deleted", async () => {
  const originalRoundFind = HiringRound.findById;
  const originalInternshipFind = Internship.findById;
  const originalAssignmentExists = RoundAssignment.exists;
  let deleted = false;
  HiringRound.findById = async () => ({ _id: roundId, internship: internshipId, async deleteOne() { deleted = true; } });
  Internship.findById = async () => ({ _id: internshipId, postedBy: { toString: () => ownerId } });
  RoundAssignment.exists = async () => true;

  try {
    const res = response();
    await getHandler("delete", "/:id")(
      { params: { id: roundId }, user: { _id: ownerId, role: "recruiter" } },
      res
    );
    assert.equal(res.statusCode, 409);
    assert.equal(deleted, false);
  } finally {
    HiringRound.findById = originalRoundFind;
    Internship.findById = originalInternshipFind;
    RoundAssignment.exists = originalAssignmentExists;
  }
});

test("recruiter upcoming-round query is scoped to that user's internships", async () => {
  const originalInternshipFind = Internship.find;
  const originalRoundFind = HiringRound.find;
  let roundFilter;
  Internship.find = () => ({ select: async () => [{ _id: internshipId }] });
  HiringRound.find = (filter) => {
    roundFilter = filter;
    return {
      populate() { return this; },
      sort() { return this; },
      limit: async () => [],
    };
  };

  try {
    const res = response();
    await getHandler("get", "/upcoming/recruiter")({ user: { _id: ownerId, role: "recruiter" } }, res);
    assert.deepEqual(roundFilter.internship, { $in: [internshipId] });
    assert.equal(roundFilter.published, true);
    assert.ok(roundFilter.scheduledAt.$gte instanceof Date);
  } finally {
    Internship.find = originalInternshipFind;
    HiringRound.find = originalRoundFind;
  }
});

test("candidate outcomes cannot be published before the round is published", async () => {
  const originalRoundFind = HiringRound.findById;
  const originalInternshipFind = Internship.findById;
  const originalAssignmentFind = RoundAssignment.findOne;
  let assignmentQueried = false;
  HiringRound.findById = async () => ({ _id: roundId, internship: internshipId, published: false });
  Internship.findById = async () => ({ _id: internshipId, postedBy: { toString: () => ownerId } });
  RoundAssignment.findOne = async () => { assignmentQueried = true; };

  try {
    const res = response();
    await getHandler("put", "/:id/results/:applicationId")(
      {
        params: { id: roundId, applicationId: "507f1f77bcf86cd799439017" },
        body: { outcome: "passed", resultPublished: true },
        user: { _id: ownerId, role: "recruiter" },
      },
      res
    );
    assert.equal(res.statusCode, 409);
    assert.equal(assignmentQueried, false);
  } finally {
    HiringRound.findById = originalRoundFind;
    Internship.findById = originalInternshipFind;
    RoundAssignment.findOne = originalAssignmentFind;
  }
});