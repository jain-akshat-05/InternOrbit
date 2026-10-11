const mongoose = require("mongoose");

const hiringRoundSchema = new mongoose.Schema(
  {
    internship: { type: mongoose.Schema.Types.ObjectId, ref: "Internship", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    type: {
      type: String,
      enum: ["resume_screening", "online_assessment", "technical_interview", "hr_interview", "final_decision", "custom"],
      default: "custom",
    },
    description: { type: String, default: "", trim: true, maxlength: 2000 },
    scheduledAt: { type: Date },
    instructions: { type: String, default: "", trim: true, maxlength: 4000 },
    meetingUrl: { type: String, default: "", trim: true, maxlength: 1000 },
    order: { type: Number, default: 0, min: 0 },
    published: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

hiringRoundSchema.index({ internship: 1, order: 1, scheduledAt: 1 });

module.exports = mongoose.model("HiringRound", hiringRoundSchema);