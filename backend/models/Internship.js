const mongoose = require("mongoose");

const internshipSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    company: { type: String, required: true },
    description: { type: String, required: true },
    location: { type: String, default: "Remote" },
    stipend: { type: Number, default: 0 },
    duration: { type: String, default: "3 months" },
    skillsRequired: [{ type: String }],
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Internship", internshipSchema);
