const mongoose = require("mongoose");

const roundAssignmentSchema = new mongoose.Schema(
  {
    round: { type: mongoose.Schema.Types.ObjectId, ref: "HiringRound", required: true },
    application: { type: mongoose.Schema.Types.ObjectId, ref: "Application", required: true },
    outcome: { type: String, enum: ["pending", "passed", "failed", "not_attended"], default: "pending" },
    privateFeedback: { type: String, default: "", maxlength: 4000 },
    resultPublished: { type: Boolean, default: false },
    resultPublishedAt: { type: Date, default: null },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

roundAssignmentSchema.index({ round: 1, application: 1 }, { unique: true });
roundAssignmentSchema.index({ application: 1, round: 1 });

module.exports = mongoose.model("RoundAssignment", roundAssignmentSchema);