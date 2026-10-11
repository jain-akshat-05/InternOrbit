const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
  {
    internship: { type: mongoose.Schema.Types.ObjectId, ref: "Internship", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    recruiter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["applied", "shortlisted", "assessment", "interview", "selected", "rejected", "withdrawn"],
      default: "applied",
    },
    coverNote: { type: String, default: "" },
    coverLetter: { type: String, default: "", maxlength: 5000 },
    resume: { type: mongoose.Schema.Types.ObjectId, ref: "Resume", default: null },
    answers: [{
      question: { type: String, required: true, trim: true, maxlength: 400 },
      answer: { type: String, required: true, trim: true, maxlength: 3000 },
    }],
    statusHistory: [{
      from: { type: String, default: null },
      to: { type: String, required: true },
      changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      note: { type: String, default: "", maxlength: 1000 },
      changedAt: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true }
);

// prevent duplicate applications by same student to same internship
applicationSchema.index({ internship: 1, student: 1 }, { unique: true });

module.exports = mongoose.model("Application", applicationSchema);
