const express = require("express");
const Application = require("../models/Application");
const HiringRound = require("../models/HiringRound");
const Internship = require("../models/Internship");
const RoundAssignment = require("../models/RoundAssignment");
const { protect, authorize } = require("../middleware/auth");
const { isValidObjectId, sendApiError } = require("../utils/apiErrors");
const { createNotification } = require("../utils/notifications");

const router = express.Router();
const ROUND_TYPES = ["resume_screening", "online_assessment", "technical_interview", "hr_interview", "final_decision", "custom"];
const OUTCOMES = ["pending", "passed", "failed", "not_attended"];

const validateUrl = (value) => {
  if (!value) return "";
  if (typeof value !== "string" || value.length > 1000) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? value : null;
  } catch {
    return null;
  }
};

const canManageInternship = (internship, user) =>
  Boolean(internship) && (user.role === "admin" || internship.postedBy.toString() === user._id.toString());

const notifyCandidates = async (io, assignments, type, title, message) => {
  for (const assignment of assignments) {
    try {
      const application = assignment.application?.student
        ? assignment.application
        : await Application.findById(assignment.application).populate("student", "_id");
      if (!application?.student) continue;
      const studentId = application.student._id || application.student;
      await createNotification(io, {
        user: studentId,
        type,
        title,
        message,
        application: application._id,
      });
    } catch (err) {
      console.error("Round notification failed", { name: err?.name || "Error" });
    }
  }
};

router.get("/internship/:internshipId", protect, authorize("recruiter", "admin"), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.internshipId)) return res.status(400).json({ message: "Invalid internship ID" });
    const internship = await Internship.findById(req.params.internshipId);
    if (!internship) return res.status(404).json({ message: "Internship not found" });
    if (!canManageInternship(internship, req.user)) return res.status(403).json({ message: "Not authorized to manage these rounds" });
    const rounds = await HiringRound.find({ internship: internship._id }).sort({ order: 1, scheduledAt: 1, createdAt: 1 });
    res.json(rounds);
  } catch (err) {
    return sendApiError(res, err);
  }
});

router.get("/upcoming/recruiter", protect, authorize("recruiter", "admin"), async (req, res) => {
  try {
    const internships = await Internship.find({ postedBy: req.user._id }).select("_id");
    if (internships.length === 0) return res.json([]);
    const rounds = await HiringRound.find({
      internship: { $in: internships.map((internship) => internship._id) },
      published: true,
      scheduledAt: { $gte: new Date() },
    })
      .populate("internship", "title company")
      .sort({ scheduledAt: 1 })
      .limit(100);
    res.json(rounds);
  } catch (err) {
    return sendApiError(res, err);
  }
});

router.get("/:id/assignments", protect, authorize("recruiter", "admin"), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid round ID" });
    const round = await HiringRound.findById(req.params.id);
    if (!round) return res.status(404).json({ message: "Round not found" });
    const internship = await Internship.findById(round.internship);
    if (!canManageInternship(internship, req.user)) return res.status(403).json({ message: "Not authorized to view these candidates" });
    const assignments = await RoundAssignment.find({ round: round._id })
      .populate({ path: "application", select: "student status", populate: { path: "student", select: "name email" } })
      .sort({ createdAt: 1 });
    res.json(assignments.map((assignment) => ({
      _id: assignment._id,
      applicationId: assignment.application?._id,
      student: assignment.application?.student,
      applicationStatus: assignment.application?.status,
      outcome: assignment.outcome,
      privateFeedback: assignment.privateFeedback,
      resultPublished: assignment.resultPublished,
    })));
  } catch (err) {
    return sendApiError(res, err);
  }
});

router.post("/", protect, authorize("recruiter", "admin"), async (req, res) => {
  try {
    const { internshipId, title, type = "custom", description = "", scheduledAt, instructions = "", meetingUrl = "", order = 0, published = false } = req.body || {};
    if (!isValidObjectId(internshipId)) return res.status(400).json({ message: "Invalid internship ID" });
    if (typeof title !== "string" || !title.trim() || title.trim().length > 120) return res.status(400).json({ message: "Round title is required (maximum 120 characters)" });
    if (!ROUND_TYPES.includes(type)) return res.status(400).json({ message: "Invalid round type" });
    if (scheduledAt && Number.isNaN(Date.parse(scheduledAt))) return res.status(400).json({ message: "Invalid round date" });
    const safeMeetingUrl = validateUrl(meetingUrl);
    if (safeMeetingUrl === null) return res.status(400).json({ message: "Meeting link must be a valid HTTP or HTTPS URL" });
    if (!Number.isInteger(Number(order)) || Number(order) < 0 || Number(order) > 1000) return res.status(400).json({ message: "Round order must be between 0 and 1000" });
    if (typeof published !== "boolean") return res.status(400).json({ message: "Published must be a boolean" });

    const internship = await Internship.findById(internshipId);
    if (!internship) return res.status(404).json({ message: "Internship not found" });
    if (!canManageInternship(internship, req.user)) return res.status(403).json({ message: "Not authorized to manage these rounds" });

    const round = await HiringRound.create({
      internship: internship._id,
      title: title.trim(),
      type,
      description: typeof description === "string" ? description.trim().slice(0, 2000) : "",
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      instructions: typeof instructions === "string" ? instructions.trim().slice(0, 4000) : "",
      meetingUrl: safeMeetingUrl,
      order: Number(order),
      published,
      createdBy: req.user._id,
    });
    res.status(201).json(round);
  } catch (err) {
    return sendApiError(res, err);
  }
});

router.put("/:id", protect, authorize("recruiter", "admin"), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid round ID" });
    const round = await HiringRound.findById(req.params.id);
    if (!round) return res.status(404).json({ message: "Round not found" });
    const internship = await Internship.findById(round.internship);
    if (!canManageInternship(internship, req.user)) return res.status(403).json({ message: "Not authorized to manage this round" });

    const body = req.body || {};
    const allowedFields = ["title", "type", "description", "scheduledAt", "instructions", "meetingUrl", "order", "published"];
    const updates = Object.keys(body);
    if (updates.some((field) => !allowedFields.includes(field))) return res.status(400).json({ message: "Unsupported round field" });
    if (body.title !== undefined && (typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 120)) return res.status(400).json({ message: "Invalid round title" });
    if (body.type !== undefined && !ROUND_TYPES.includes(body.type)) return res.status(400).json({ message: "Invalid round type" });
    if (body.scheduledAt !== undefined && body.scheduledAt !== null && Number.isNaN(Date.parse(body.scheduledAt))) return res.status(400).json({ message: "Invalid round date" });
    if (body.meetingUrl !== undefined) {
      const safeMeetingUrl = validateUrl(body.meetingUrl);
      if (safeMeetingUrl === null) return res.status(400).json({ message: "Meeting link must be a valid HTTP or HTTPS URL" });
      round.meetingUrl = safeMeetingUrl;
    }
    if (body.order !== undefined) {
      if (!Number.isInteger(Number(body.order)) || Number(body.order) < 0 || Number(body.order) > 1000) return res.status(400).json({ message: "Invalid round order" });
      round.order = Number(body.order);
    }
    if (body.published !== undefined && typeof body.published !== "boolean") return res.status(400).json({ message: "Published must be a boolean" });

    const currentScheduleTime = round.scheduledAt ? new Date(round.scheduledAt).getTime() : null;
    const nextScheduleTime = body.scheduledAt ? new Date(body.scheduledAt).getTime() : null;
    const scheduleChanged = body.scheduledAt !== undefined && currentScheduleTime !== nextScheduleTime;
    const newlyPublished = body.published === true && !round.published;
    for (const field of ["title", "description", "instructions", "published"]) {
      if (body[field] !== undefined) round[field] = typeof body[field] === "string" ? body[field].trim() : body[field];
    }
    if (body.scheduledAt !== undefined) round.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
    await round.save();

    if (round.published && (scheduleChanged || newlyPublished)) {
      const assignments = await RoundAssignment.find({ round: round._id }).populate({
        path: "application",
        select: "student",
      });
      await notifyCandidates(
        req.app.get("io"),
        assignments,
        scheduleChanged ? "round_rescheduled" : "round_published",
        scheduleChanged ? "Interview round rescheduled" : "New interview round",
        `${round.title}${round.scheduledAt ? `: ${round.scheduledAt.toLocaleString()}` : ""}`
      );
    }
    res.json(round);
  } catch (err) {
    return sendApiError(res, err);
  }
});

router.delete("/:id", protect, authorize("recruiter", "admin"), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid round ID" });
    const round = await HiringRound.findById(req.params.id);
    if (!round) return res.status(404).json({ message: "Round not found" });
    const internship = await Internship.findById(round.internship);
    if (!canManageInternship(internship, req.user)) return res.status(403).json({ message: "Not authorized to remove this round" });
    if (await RoundAssignment.exists({ round: round._id })) {
      return res.status(409).json({ message: "This round has candidate history and cannot be deleted" });
    }
    await round.deleteOne();
    res.json({ message: "Round removed" });
  } catch (err) {
    return sendApiError(res, err);
  }
});

router.post("/:id/assign", protect, authorize("recruiter", "admin"), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid round ID" });
    const { applicationIds } = req.body || {};
    if (!Array.isArray(applicationIds) || applicationIds.length < 1 || applicationIds.length > 100 || applicationIds.some((id) => !isValidObjectId(id))) {
      return res.status(400).json({ message: "Select between 1 and 100 valid applications" });
    }
    const round = await HiringRound.findById(req.params.id);
    if (!round) return res.status(404).json({ message: "Round not found" });
    const internship = await Internship.findById(round.internship);
    if (!canManageInternship(internship, req.user)) return res.status(403).json({ message: "Not authorized to assign candidates" });
    const uniqueIds = [...new Set(applicationIds)];
    const applications = await Application.find({
      _id: { $in: uniqueIds },
      internship: internship._id,
      status: { $nin: ["rejected", "withdrawn"] },
    }).select("_id student");
    if (applications.length !== uniqueIds.length) return res.status(400).json({ message: "Every selected candidate must have an active application for this internship" });

    const assignments = [];
    for (const application of applications) {
      try {
        const assignment = await RoundAssignment.findOneAndUpdate(
          { round: round._id, application: application._id },
          { $setOnInsert: { round: round._id, application: application._id, assignedBy: req.user._id } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        assignments.push(assignment);
      } catch (err) {
        if (err.code !== 11000) throw err;
      }
    }

    if (round.published) {
      await notifyCandidates(req.app.get("io"), applications.map((application) => ({ application })), "round_published", "Interview round assigned", round.title);
    }
    res.status(201).json(assignments);
  } catch (err) {
    return sendApiError(res, err);
  }
});

router.put("/:id/results/:applicationId", protect, authorize("recruiter", "admin"), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id) || !isValidObjectId(req.params.applicationId)) return res.status(400).json({ message: "Invalid round or application ID" });
    const { outcome, privateFeedback = "", resultPublished = false } = req.body || {};
    if (!OUTCOMES.includes(outcome)) return res.status(400).json({ message: "Invalid round outcome" });
    if (typeof privateFeedback !== "string" || privateFeedback.length > 4000) return res.status(400).json({ message: "Feedback must be 4000 characters or fewer" });
    if (typeof resultPublished !== "boolean" || (resultPublished && outcome === "pending")) return res.status(400).json({ message: "Publish a completed round outcome" });

    const round = await HiringRound.findById(req.params.id);
    if (!round) return res.status(404).json({ message: "Round not found" });
    const internship = await Internship.findById(round.internship);
    if (!canManageInternship(internship, req.user)) return res.status(403).json({ message: "Not authorized to update round results" });
    if (resultPublished && !round.published) return res.status(409).json({ message: "Publish the round before publishing candidate results" });
    const assignment = await RoundAssignment.findOne({ round: round._id, application: req.params.applicationId });
    if (!assignment) return res.status(404).json({ message: "Candidate is not assigned to this round" });

    const shouldNotify = resultPublished && (!assignment.resultPublished || assignment.outcome !== outcome);
    assignment.outcome = outcome;
    assignment.privateFeedback = privateFeedback.trim();
    assignment.resultPublished = resultPublished;
    assignment.resultPublishedAt = resultPublished ? new Date() : null;
    await assignment.save();

    if (shouldNotify) {
      const application = await Application.findById(assignment.application);
      await notifyCandidates(req.app.get("io"), [{ application }], "round_result", "Interview round result published", `${round.title}: ${outcome}`);
    }
    res.json({ _id: assignment._id, round: round._id, application: assignment.application, outcome, resultPublished, resultPublishedAt: assignment.resultPublishedAt });
  } catch (err) {
    return sendApiError(res, err);
  }
});

module.exports = router;