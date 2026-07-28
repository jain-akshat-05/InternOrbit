const express = require("express");
const User = require("../models/User");
const Internship = require("../models/Internship");
const Application = require("../models/Application");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

// @route GET /api/admin/stats  (overall platform analytics)
router.get("/stats", protect, authorize("admin"), async (req, res) => {
  try {
    const [totalStudents, totalRecruiters, totalInternships, totalApplications] = await Promise.all([
      User.countDocuments({ role: "student" }),
      User.countDocuments({ role: "recruiter" }),
      Internship.countDocuments(),
      Application.countDocuments(),
    ]);

    const statusBreakdown = await Application.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // recruiter performance: number of postings + applications received per recruiter
    const recruiterPerformance = await Internship.aggregate([
      {
        $group: {
          _id: "$postedBy",
          totalPostings: { $sum: 1 },
        },
      },
      {
        $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "recruiter" },
      },
      { $unwind: "$recruiter" },
      {
        $project: {
          name: "$recruiter.name",
          company: "$recruiter.company",
          totalPostings: 1,
        },
      },
    ]);

    res.json({
      totalStudents,
      totalRecruiters,
      totalInternships,
      totalApplications,
      statusBreakdown,
      recruiterPerformance,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
