const mongoose = require("mongoose");

const resumeSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    storageKey: { type: String, required: true, unique: true, select: false },
    originalName: { type: String, required: true, maxlength: 180 },
    mimeType: { type: String, enum: ["application/pdf"], default: "application/pdf" },
    size: { type: Number, required: true, min: 1 },
    sha256: { type: String, required: true, select: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Resume", resumeSchema);