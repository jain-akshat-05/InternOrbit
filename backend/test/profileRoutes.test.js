const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const Resume = require("../models/Resume");
const User = require("../models/User");
const createProfileRoutes = require("../routes/profileRoutes");

const userId = "507f1f77bcf86cd799439011";
const resumeId = "507f1f77bcf86cd799439012";

const getHandler = (router, method, routePath) => {
  const route = router.stack.find((layer) => layer.route?.path === routePath && layer.route.methods[method]);
  return route.route.stack.at(-1).handle;
};

const createResponse = () => ({
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test("profile updates ignore role/email mass assignment and validate profile values", async () => {
  const router = createProfileRoutes({ resumeMaxBytes: 1024, resumeStorageDir: path.resolve("test-resumes") });
  const handler = getHandler(router, "put", "/me");
  const originalFindById = User.findById;
  let saved = false;
  const user = {
    _id: userId,
    name: "Student",
    email: "student@example.test",
    role: "student",
    profile: { phone: "", college: "", degree: "", portfolioUrl: "" },
    skills: [],
    async save() { saved = true; },
  };
  User.findById = async () => user;

  try {
    const res = createResponse();
    await handler({
      body: { name: "Updated Student", email: "attacker@example.test", role: "admin", profile: { college: "Example College" } },
      user: { _id: userId },
    }, res);
    assert.equal(res.statusCode, undefined);
    assert.equal(user.name, "Updated Student");
    assert.equal(user.email, "student@example.test");
    assert.equal(user.role, "student");
    assert.equal(user.profile.college, "Example College");
    assert.equal(saved, true);
  } finally {
    User.findById = originalFindById;
  }
});

test("resume upload rejects non-PDF content and stores valid PDFs privately", async () => {
  const storageDir = await fs.mkdtemp(path.join(os.tmpdir(), "internorbit-resumes-"));
  const router = createProfileRoutes({ resumeMaxBytes: 4096, resumeStorageDir: storageDir });
  const handler = getHandler(router, "put", "/me/resume");
  const originalFindById = User.findById;
  const originalResumeCreate = Resume.create;
  const user = { _id: userId, currentResume: null, async save() {} };
  let created = 0;
  User.findById = async () => user;
  Resume.create = async (data) => {
    created += 1;
    return { _id: resumeId, originalName: data.originalName, size: data.size, createdAt: new Date() };
  };

  try {
    const invalidResponse = createResponse();
    await handler({ body: Buffer.from("not a pdf"), get: () => "resume.pdf", user: { _id: userId } }, invalidResponse);
    assert.equal(invalidResponse.statusCode, 415);
    assert.equal(created, 0);

    const pdf = Buffer.from("%PDF-1.7\nminimal test PDF\n%%EOF");
    const validResponse = createResponse();
    await handler({ body: pdf, get: () => encodeURIComponent("candidate resume.pdf"), user: { _id: userId } }, validResponse);
    assert.equal(validResponse.statusCode, 201);
    assert.equal(created, 1);
    assert.equal(user.currentResume, resumeId);
    assert.equal(validResponse.body.originalName, "candidate_resume.pdf");
    const files = await fs.readdir(storageDir);
    assert.equal(files.length, 1);
    assert.match(files[0], /^[a-f0-9-]{36}\.pdf$/i);
    assert.deepEqual(await fs.readFile(path.join(storageDir, files[0])), pdf);
  } finally {
    User.findById = originalFindById;
    Resume.create = originalResumeCreate;
    await fs.rm(storageDir, { recursive: true, force: true });
  }
});