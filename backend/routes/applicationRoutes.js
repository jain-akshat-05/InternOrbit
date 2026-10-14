const express = require("express");
const Application = require("../models/Application");
const Internship = require("../models/Internship");
const Resume = require("../models/Resume");
const RoundAssignment = require("../models/RoundAssignment");
const { protect, authorize } = require("../middleware/auth");
const { isValidObjectId, sendApiError } = require("../utils/apiErrors");
const { createNotification } = require("../utils/notifications");
const { createResumeStore } = require("../utils/resumeStore");

const router = express.Router();
const APPLICATION_TRANSITIONS = {
  applied: ["shortlisted", "rejected", "withdrawn"],
  shortlisted: ["assessment", "interview", "rejected", "withdrawn"],
  assessment: ["interview", "rejected", "withdrawn"],
  interview: ["selected", "rejected", "withdrawn"],
  selected: [],
  rejected: [],
  withdrawn: [],
};

const createApplicationRoutes = (config, resumeStore = createResumeStore(config)) => {
  // @route POST /api/applications  (student applies to an internship)
router.post("/", protect, authorize("student"), async (req, res) => {
  try {
    if (config.resumeStorageDisabled) {
      return res.status(503).json({ message: "Applications are temporarily unavailable while resume storage is disabled" });
    }
    const { internshipId, coverNote, coverLetter, resumeId, answers = [] } = req.body || {};
    if (!isValidObjectId(internshipId)) {
      return res.status(400).json({ message: "Invalid internship ID" });
    }
    if (coverNote !== undefined && (typeof coverNote !== "string" || coverNote.length > 2000)) {
      return res.status(400).json({ message: "Cover note must be 2000 characters or fewer" });
    }
    const internship = await Internship.findById(internshipId);
    if (!internship || !internship.isActive) {
      return res.status(404).json({ message: "Internship not found" });
    }
    const selectedResumeId = resumeId || req.user.currentResume;
    if (!selectedResumeId || !isValidObjectId(selectedResumeId.toString())) {
      return res.status(400).json({ message: "Upload or select a resume before applying" });
    }
    const resume = await Resume.findOne({ _id: selectedResumeId, owner: req.user._id }).select("originalName size");
    if (!resume) return res.status(404).json({ message: "Resume not found" });

    const questions = internship.applicationQuestions || [];
    if (!Array.isArray(answers) || answers.length !== questions.length) {
      return res.status(400).json({ message: "Answer all required application questions" });
    }
    const answerMap = new Map();
    for (const item of answers) {
      if (!item || typeof item.question !== "string" || typeof item.answer !== "string" || item.answer.trim().length > 3000) {
        return res.status(400).json({ message: "Application answers are invalid" });
      }
      answerMap.set(item.question, item.answer.trim());
    }
    if (answerMap.size !== answers.length || questions.some((question) => !answerMap.get(question))) {
      return res.status(400).json({ message: "Answer all required application questions" });
    }

    const application = await Application.create({
      internship: internship._id,
      student: req.user._id,
      recruiter: internship.postedBy,
      coverNote: coverNote || "",
      coverLetter: typeof coverLetter === "string" ? coverLetter.trim() : coverNote || "",
      resume: resume._id,
      answers: questions.map((question) => ({ question, answer: answerMap.get(question) })),
      statusHistory: [{ to: "applied", changedBy: req.user._id }],
    });

    const populated = await application.populate([
      { path: "internship", select: "title company" },
      { path: "student", select: "name email" },
      { path: "resume", select: "originalName size createdAt" },
    ]);

    const io = req.app.get("io");
    try {
      await createNotification(io, {
        user: req.user._id,
        type: "application_submitted",
        title: "Application submitted",
        message: `Your application for ${internship.title} was submitted`,
        application: application._id,
      });
    } catch (notificationError) {
      console.error("Notification persistence failed", { name: notificationError?.name || "Error" });
    }
    try {
      await createNotification(io, {
        user: internship.postedBy,
        type: "application_received",
        title: "New internship application",
        message: `${req.user.name} applied to ${internship.title}`,
        application: application._id,
      });
    } catch (notificationError) {
      console.error("Notification persistence failed", { name: notificationError?.name || "Error" });
    }
    io?.to(`user:${internship.postedBy}`).emit("new_application", populated);

    res.status(201).json(populated);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "You already applied to this internship" });
    }
    return sendApiError(res, err);
  }
});

// @route GET /api/applications/mine  (student's own applications)
router.get("/mine", protect, authorize("student"), async (req, res) => {
  try {
    const applications = await Application.find({ student: req.user._id })
      .populate("internship", "title company location stipend")
      .populate("resume", "originalName size createdAt")
      .sort({ createdAt: -1 });
    if (applications.length === 0) return res.json([]);
    const assignments = await RoundAssignment.find({ application: { $in: applications.map((application) => application._id) } })
      .populate({ path: "round", select: "title type scheduledAt instructions meetingUrl published" })
      .sort({ createdAt: 1 });
    const upcomingByApplication = new Map();
    const now = Date.now();
    for (const assignment of assignments) {
      if (!assignment.round?.published || !assignment.round.scheduledAt || assignment.round.scheduledAt.getTime() < now) continue;
      if (!upcomingByApplication.has(assignment.application.toString())) upcomingByApplication.set(assignment.application.toString(), []);
      upcomingByApplication.get(assignment.application.toString()).push({
        _id: assignment.round._id,
        title: assignment.round.title,
        type: assignment.round.type,
        scheduledAt: assignment.round.scheduledAt,
        instructions: assignment.round.instructions,
        meetingUrl: assignment.round.meetingUrl,
      });
    }
    res.json(applications.map((application) => ({
      ...application.toObject(),
      upcomingRounds: ["selected", "rejected", "withdrawn"].includes(application.status)
        ? []
        : upcomingByApplication.get(application._id.toString()) || [],
    })));
  } catch (err) {
    return sendApiError(res, err);
  }
});

// @route GET /api/applications/received/summary (counts recruiter-owned applications)
router.get("/received/summary", protect, authorize("recruiter", "admin"), async (req, res) => {
  try {
    const statusBreakdown = await Application.aggregate([
      { $match: { recruiter: req.user._id } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    res.json({
      totalApplications: statusBreakdown.reduce((total, status) => total + status.count, 0),
      statusBreakdown,
    });
  } catch (err) {
    return sendApiError(res, err);
  }
});

// @route GET /api/applications/received  (recruiter views applications to their postings)
router.get("/received", protect, authorize("recruiter", "admin"), async (req, res) => {
  try {
    const filter = { recruiter: req.user._id };
    if (req.query.status) {
      if (!Object.hasOwn(APPLICATION_TRANSITIONS, req.query.status)) {
        return res.status(400).json({ message: "Invalid application status filter" });
      }
      filter.status = req.query.status;
    }
    if (req.query.internshipId) {
      if (!isValidObjectId(req.query.internshipId)) return res.status(400).json({ message: "Invalid internship ID" });
      filter.internship = req.query.internshipId;
    }
    const sortDirection = req.query.sort === "oldest" ? 1 : -1;
    const applications = await Application.find(filter)
      .populate("internship", "title company")
      .populate("student", "name email skills profile companyProfile")
      .populate("resume", "originalName size createdAt")
      .sort({ createdAt: sortDirection })
      .limit(200);
    res.json(applications);
  } catch (err) {
    return sendApiError(res, err);
  }
});

router.get("/:id", protect, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid application ID" });
    const application = await Application.findById(req.params.id)
      .populate("internship", "title company location stipend description postedBy")
      .populate("student", "name email skills profile companyProfile")
      .populate("resume", "originalName size createdAt");
    if (!application) return res.status(404).json({ message: "Application not found" });

    const isStudentOwner = req.user.role === "student" && application.student._id.toString() === req.user._id.toString();
    const isRecruiterOwner = req.user.role === "recruiter" && application.recruiter.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";
    if (!isStudentOwner && !isRecruiterOwner && !isAdmin) {
      return res.status(403).json({ message: "Not authorized to view this application" });
    }

    const assignments = await RoundAssignment.find({ application: application._id }).populate("round").sort({ createdAt: 1 });
    const rounds = assignments
      .filter((assignment) => isRecruiterOwner || isAdmin || (assignment.round?.published && (application.status !== "withdrawn" || assignment.resultPublished)))
      .map((assignment) => ({
        _id: assignment._id,
        round: assignment.round,
        outcome: isRecruiterOwner || isAdmin || assignment.resultPublished ? assignment.outcome : null,
        resultPublished: isRecruiterOwner || isAdmin || assignment.resultPublished,
        ...(isRecruiterOwner || isAdmin ? { privateFeedback: assignment.privateFeedback } : {}),
      }));

    res.json({ ...application.toObject(), rounds });
  } catch (err) {
    return sendApiError(res, err);
  }
});

router.patch("/:id/withdraw", protect, authorize("student"), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid application ID" });
    const application = await Application.findById(req.params.id);
    if (!application) return res.status(404).json({ message: "Application not found" });
    if (application.student.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to withdraw this application" });
    }
    if (!APPLICATION_TRANSITIONS[application.status]?.includes("withdrawn")) {
      return res.status(409).json({ message: "This application can no longer be withdrawn" });
    }

    application.statusHistory.push({ from: application.status, to: "withdrawn", changedBy: req.user._id });
    application.status = "withdrawn";
    await application.save();
    try {
      await createNotification(req.app.get("io"), {
        user: application.recruiter,
        type: "application_status",
        title: "Application withdrawn",
        message: `${req.user.name} withdrew an application`,
        application: application._id,
      });
    } catch (notificationError) {
      console.error("Notification persistence failed", { name: notificationError?.name || "Error" });
    }
    res.json({ message: "Application withdrawn", status: application.status });
  } catch (err) {
    return sendApiError(res, err);
  }
});

router.get("/:id/resume", protect, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid application ID" });
    const application = await Application.findById(req.params.id).populate("internship", "postedBy");
    if (!application) return res.status(404).json({ message: "Application not found" });
    const isStudentOwner = req.user.role === "student" && application.student.toString() === req.user._id.toString();
    const isRecruiterOwner = req.user.role === "recruiter" && application.recruiter.toString() === req.user._id.toString() && application.internship.postedBy.toString() === req.user._id.toString();
    if (!isStudentOwner && !isRecruiterOwner && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to access this resume" });
    }
    if (config.resumeStorageDisabled) {
      return res.status(503).json({ message: "Resume storage is temporarily disabled" });
    }
    if (!application.resume) return res.status(404).json({ message: "Application has no attached resume" });
    const resume = await Resume.findById(application.resume).select("+storageKey");
    if (!resume) return res.status(404).json({ message: "Resume not found" });
    const contents = await resumeStore.read(resume.storageKey);
    res
      .type("application/pdf")
      .set("X-Content-Type-Options", "nosniff")
      .attachment(resume.originalName)
      .send(contents);
  } catch (err) {
    return sendApiError(res, err);
  }
});

// @route PUT /api/applications/:id/status  (recruiter updates status -> pushed live to student)
router.put("/:id/status", protect, authorize("recruiter", "admin"), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid application ID" });
    }
    const { status } = req.body || {};
    if (!Object.hasOwn(APPLICATION_TRANSITIONS, status)) return res.status(400).json({ message: "Invalid status" });

    const application = await Application.findById(req.params.id);
    if (!application) return res.status(404).json({ message: "Application not found" });
    if (application.recruiter.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to update this application" });
    }

    if (status !== application.status && !APPLICATION_TRANSITIONS[application.status]?.includes(status)) {
      return res.status(409).json({ message: `Cannot move an application from ${application.status} to ${status}` });
    }

    if (status !== application.status) {
      application.statusHistory.push({ from: application.status, to: status, changedBy: req.user._id });
    }
    application.status = status;
    await application.save();

    const populated = await application.populate([
      { path: "internship", select: "title company" },
    ]);

    const io = req.app.get("io");
    try {
      await createNotification(io, {
        user: application.student,
        type: "application_status",
        title: "Application status updated",
        message: `${application.internship?.title || "An internship"}: ${status}`,
        application: application._id,
      });
    } catch (notificationError) {
      console.error("Notification persistence failed", { name: notificationError?.name || "Error" });
    }
    io?.to(`user:${application.student}`).emit("application_status_update", populated);

    res.json(populated);
  } catch (err) {
    return sendApiError(res, err);
  }
});

  return router;
};

module.exports = createApplicationRoutes;
