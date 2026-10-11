const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ["student", "recruiter", "admin"], default: "student" },
    company: { type: String, default: "" }, // used for recruiters
    resumeUrl: { type: String, default: "" }, // used for students
    skills: [{ type: String }],
    profile: {
      phone: { type: String, default: "", trim: true },
      education: { type: String, default: "", trim: true },
      college: { type: String, default: "", trim: true },
      degree: { type: String, default: "", trim: true },
      graduationYear: { type: Number, min: 1950, max: 2100 },
      portfolioUrl: { type: String, default: "", trim: true },
      githubUrl: { type: String, default: "", trim: true },
      linkedinUrl: { type: String, default: "", trim: true },
    },
    companyProfile: {
      description: { type: String, default: "", trim: true, maxlength: 2000 },
      website: { type: String, default: "", trim: true },
      industry: { type: String, default: "", trim: true, maxlength: 100 },
    },
    currentResume: { type: mongoose.Schema.Types.ObjectId, ref: "Resume", default: null },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model("User", userSchema);
