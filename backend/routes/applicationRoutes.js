const express = require("express");
const Application = require("../models/Application");
const Internship = require("../models/Internship");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

// @route POST /api/applications  (student applies to an internship)
router.post("/", protect, authorize("student"), async (req, res) => {
  try {
    const { internshipId, coverNote } = req.body;
    const internship = await Internship.findById(internshipId);
    if (!internship) return res.status(404).json({ message: "Internship not found" });

    const application = await Application.create({
      internship: internship._id,
      student: req.user._id,
      recruiter: internship.postedBy,
      coverNote: coverNote || "",
    });

    const populated = await application.populate([
      { path: "internship", select: "title company" },
      { path: "student", select: "name email" },
    ]);

    // notify recruiter's room in real time
    const io = req.app.get("io");
    io.to(`user:${internship.postedBy}`).emit("new_application", populated);

    res.status(201).json(populated);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "You already applied to this internship" });
    }
    res.status(500).json({ message: err.message });
  }
});

// @route GET /api/applications/mine  (student's own applications)
router.get("/mine", protect, authorize("student"), async (req, res) => {
  try {
    const applications = await Application.find({ student: req.user._id })
      .populate("internship", "title company location stipend")
      .sort({ createdAt: -1 });
    res.json(applications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route GET /api/applications/received  (recruiter views applications to their postings)
router.get("/received", protect, authorize("recruiter", "admin"), async (req, res) => {
  try {
    const applications = await Application.find({ recruiter: req.user._id })
      .populate("internship", "title company")
      .populate("student", "name email skills resumeUrl")
      .sort({ createdAt: -1 });
    res.json(applications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route PUT /api/applications/:id/status  (recruiter updates status -> pushed live to student)
router.put("/:id/status", protect, authorize("recruiter", "admin"), async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["applied", "shortlisted", "interview", "rejected", "selected"];
    if (!allowed.includes(status)) return res.status(400).json({ message: "Invalid status" });

    const application = await Application.findById(req.params.id);
    if (!application) return res.status(404).json({ message: "Application not found" });
    if (application.recruiter.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to update this application" });
    }

    application.status = status;
    await application.save();

    const populated = await application.populate([
      { path: "internship", select: "title company" },
    ]);

    // notify the student's room in real time
    const io = req.app.get("io");
    io.to(`user:${application.student}`).emit("application_status_update", populated);

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
