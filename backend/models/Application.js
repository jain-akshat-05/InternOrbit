const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
  {
    internship: { type: mongoose.Schema.Types.ObjectId, ref: "Internship", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    recruiter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["applied", "shortlisted", "interview", "rejected", "selected"],
      default: "applied",
    },
    coverNote: { type: String, default: "" },
  },
  { timestamps: true }
);

// prevent duplicate applications by same student to same internship
applicationSchema.index({ internship: 1, student: 1 }, { unique: true });

module.exports = mongoose.model("Application", applicationSchema);
