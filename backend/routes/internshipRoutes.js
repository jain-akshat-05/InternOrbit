const express = require("express");
const Internship = require("../models/Internship");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

// @route GET /api/internships  (public list, with optional search)
router.get("/", async (req, res) => {
  try {
    const { search, location } = req.query;
    const filter = { isActive: true };
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { company: { $regex: search, $options: "i" } },
        { skillsRequired: { $regex: search, $options: "i" } },
      ];
    }
    if (location) filter.location = { $regex: location, $options: "i" };

    const internships = await Internship.find(filter)
      .populate("postedBy", "name company")
      .sort({ createdAt: -1 });
    res.json(internships);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route GET /api/internships/:id
router.get("/:id", async (req, res) => {
  try {
    const internship = await Internship.findById(req.params.id).populate("postedBy", "name company");
    if (!internship) return res.status(404).json({ message: "Internship not found" });
    res.json(internship);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route POST /api/internships  (recruiter only)
router.post("/", protect, authorize("recruiter", "admin"), async (req, res) => {
  try {
    const { title, company, description, location, stipend, duration, skillsRequired } = req.body;
    const internship = await Internship.create({
      title,
      company,
      description,
      location,
      stipend,
      duration,
      skillsRequired,
      postedBy: req.user._id,
    });
    res.status(201).json(internship);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route PUT /api/internships/:id  (owner recruiter or admin only)
router.put("/:id", protect, authorize("recruiter", "admin"), async (req, res) => {
  try {
    const internship = await Internship.findById(req.params.id);
    if (!internship) return res.status(404).json({ message: "Internship not found" });
    if (internship.postedBy.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to edit this internship" });
    }
    Object.assign(internship, req.body);
    await internship.save();
    res.json(internship);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route DELETE /api/internships/:id
router.delete("/:id", protect, authorize("recruiter", "admin"), async (req, res) => {
  try {
    const internship = await Internship.findById(req.params.id);
    if (!internship) return res.status(404).json({ message: "Internship not found" });
    if (internship.postedBy.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to delete this internship" });
    }
    await internship.deleteOne();
    res.json({ message: "Internship removed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route GET /api/internships/recruiter/mine  (recruiter's own postings)
router.get("/recruiter/mine", protect, authorize("recruiter", "admin"), async (req, res) => {
  try {
    const internships = await Internship.find({ postedBy: req.user._id }).sort({ createdAt: -1 });
    res.json(internships);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
