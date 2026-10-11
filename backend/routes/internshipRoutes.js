const express = require("express");
const Internship = require("../models/Internship");
const { protect, authorize } = require("../middleware/auth");
const { isValidObjectId, sendApiError } = require("../utils/apiErrors");

const router = express.Router();

const validateQuestions = (questions) => {
  if (!Array.isArray(questions) || questions.length > 10 || questions.some((question) => typeof question !== "string" || !question.trim() || question.trim().length > 400)) {
    return null;
  }
  return questions.map((question) => question.trim());
};

// @route GET /api/internships  (public list, with optional search)
router.get("/", async (req, res) => {
  try {
    const { search, location } = req.query;
    if (
      (search !== undefined && (typeof search !== "string" || search.length > 100)) ||
      (location !== undefined && (typeof location !== "string" || location.length > 100))
    ) {
      return res.status(400).json({ message: "Search and location must be 100 characters or fewer" });
    }
    const filter = { isActive: true };
    if (search) {
      const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { title: { $regex: escapedSearch, $options: "i" } },
        { company: { $regex: escapedSearch, $options: "i" } },
        { skillsRequired: { $regex: escapedSearch, $options: "i" } },
      ];
    }
    if (location) {
      const escapedLocation = location.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.location = { $regex: escapedLocation, $options: "i" };
    }

    const internships = await Internship.find(filter)
      .populate("postedBy", "name company")
      .sort({ createdAt: -1 });
    res.json(internships);
  } catch (err) {
    return sendApiError(res, err);
  }
});

// @route GET /api/internships/recruiter/mine  (recruiter's own postings)
router.get("/recruiter/mine", protect, authorize("recruiter", "admin"), async (req, res) => {
  try {
    const internships = await Internship.find({ postedBy: req.user._id }).sort({ createdAt: -1 });
    res.json(internships);
  } catch (err) {
    return sendApiError(res, err);
  }
});

// @route GET /api/internships/:id
router.get("/:id", async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid internship ID" });
    }
    const internship = await Internship.findById(req.params.id).populate("postedBy", "name company");
    if (!internship || !internship.isActive) {
      return res.status(404).json({ message: "Internship not found" });
    }
    res.json(internship);
  } catch (err) {
    return sendApiError(res, err);
  }
});

// @route POST /api/internships  (recruiter only)
router.post("/", protect, authorize("recruiter", "admin"), async (req, res) => {
  try {
    const { title, company, description, location, stipend, duration, skillsRequired, applicationQuestions = [] } = req.body || {};
    const questions = validateQuestions(applicationQuestions);
    if (!questions) return res.status(400).json({ message: "Application questions must contain up to 10 non-empty prompts of 400 characters or fewer" });
    const internship = await Internship.create({
      title,
      company,
      description,
      location,
      stipend,
      duration,
      skillsRequired,
      applicationQuestions: questions,
      postedBy: req.user._id,
    });
    res.status(201).json(internship);
  } catch (err) {
    return sendApiError(res, err);
  }
});

// @route PUT /api/internships/:id  (owner recruiter or admin only)
router.put("/:id", protect, authorize("recruiter", "admin"), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid internship ID" });
    }
    const internship = await Internship.findById(req.params.id);
    if (!internship) return res.status(404).json({ message: "Internship not found" });
    if (internship.postedBy.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to edit this internship" });
    }
    const allowedFields = [
  "title",
  "company",
  "description",
  "location",
  "stipend",
  "duration",
  "skillsRequired",
  "applicationQuestions",
  "isActive",
];

allowedFields.forEach((field) => {
  if (req.body[field] !== undefined) {
    internship[field] = field === "applicationQuestions"
      ? validateQuestions(req.body[field])
      : req.body[field];
  }
});

if (req.body.applicationQuestions !== undefined && !internship.applicationQuestions) {
  return res.status(400).json({ message: "Application questions must contain up to 10 non-empty prompts of 400 characters or fewer" });
}

await internship.save();
    res.json(internship);
  } catch (err) {
    return sendApiError(res, err);
  }
});

// @route DELETE /api/internships/:id
router.delete("/:id", protect, authorize("recruiter", "admin"), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid internship ID" });
    }
    const internship = await Internship.findById(req.params.id);
    if (!internship) return res.status(404).json({ message: "Internship not found" });
    if (internship.postedBy.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to delete this internship" });
    }
    internship.isActive = false;
    await internship.save();
    res.json({ message: "Internship archived" });
  } catch (err) {
    return sendApiError(res, err);
  }
});

module.exports = router;
