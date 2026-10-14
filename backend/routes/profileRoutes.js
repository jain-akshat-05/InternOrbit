const crypto = require("node:crypto");
const express = require("express");
const Application = require("../models/Application");
const Resume = require("../models/Resume");
const User = require("../models/User");
const { protect, authorize } = require("../middleware/auth");
const { sendApiError, isValidObjectId } = require("../utils/apiErrors");
const { safeOriginalName } = require("../utils/resumeStorage");
const { createResumeStore } = require("../utils/resumeStore");

const PROFILE_FIELDS = [
  "phone",
  "education",
  "college",
  "degree",
  "portfolioUrl",
  "githubUrl",
  "linkedinUrl",
];
const COMPANY_FIELDS = ["description", "website", "industry"];

const validateText = (value, max, label) => {
  if (typeof value !== "string" || value.trim().length > max) {
    throw Object.assign(new Error(`${label} must be a string of ${max} characters or fewer`), { status: 400 });
  }
  return value.trim();
};

const validateUrl = (value, label) => {
  const text = validateText(value, 500, label);
  if (!text) return "";
  try {
    const parsed = new URL(text);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
  } catch {
    throw Object.assign(new Error(`${label} must be a valid HTTP or HTTPS URL`), { status: 400 });
  }
  return text;
};

const calculateCompletion = (user) => {
  const required = [
    Boolean(user.name),
    Boolean(user.email),
    Boolean(user.profile?.phone),
    Boolean(user.profile?.college),
    Boolean(user.profile?.degree),
    Boolean(user.profile?.graduationYear),
    Boolean(user.skills?.length),
    Boolean(user.currentResume),
  ];
  return Math.round((required.filter(Boolean).length / required.length) * 100);
};

const sendResume = async (res, resume, resumeStore) => {
  const contents = await resumeStore.read(resume.storageKey);
  res
    .type("application/pdf")
    .set("X-Content-Type-Options", "nosniff")
    .attachment(resume.originalName)
    .send(contents);
};

const rejectWhenResumeStorageDisabled = (config, res) => {
  if (!config.resumeStorageDisabled) return false;
  res.status(503).json({ message: "Resume storage is temporarily disabled" });
  return true;
};

const resumeStorageGate = (config) => (req, res, next) => {
  if (rejectWhenResumeStorageDisabled(config, res)) return;
  next();
};

const createProfileRoutes = (config, resumeStore = createResumeStore(config)) => {
  const router = express.Router();
  const parsePdf = express.raw({ type: "application/pdf", limit: config.resumeMaxBytes });

  router.get("/me", protect, async (req, res) => {
    try {
      const user = await User.findById(req.user._id)
        .select("-password")
        .populate("currentResume", "originalName size createdAt");
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company,
        companyProfile: user.companyProfile,
        profile: user.profile,
        skills: user.skills,
        currentResume: user.currentResume,
        profileCompletion: user.role === "student" ? calculateCompletion(user) : null,
      });
    } catch (err) {
      return sendApiError(res, err);
    }
  });

  router.put("/me", protect, async (req, res) => {
    try {
      const body = req.body || {};
      const user = await User.findById(req.user._id);
      if (!user) return res.status(404).json({ message: "User not found" });

      if (body.name !== undefined) user.name = validateText(body.name, 100, "Name");

      if (user.role === "student") {
        if (body.profile !== undefined) {
          if (!body.profile || typeof body.profile !== "object" || Array.isArray(body.profile)) {
            return res.status(400).json({ message: "Profile must be an object" });
          }
          for (const field of PROFILE_FIELDS) {
            if (body.profile[field] === undefined) continue;
            user.profile[field] = field.endsWith("Url")
              ? validateUrl(body.profile[field], field)
              : validateText(body.profile[field], field === "phone" ? 40 : 160, field);
          }
          if (body.profile.graduationYear !== undefined) {
            const year = Number(body.profile.graduationYear);
            if (!Number.isInteger(year) || year < 1950 || year > 2100) {
              return res.status(400).json({ message: "Graduation year must be between 1950 and 2100" });
            }
            user.profile.graduationYear = year;
          }
        }
        if (body.skills !== undefined) {
          if (!Array.isArray(body.skills) || body.skills.length > 40 || body.skills.some((skill) => typeof skill !== "string" || skill.trim().length > 80)) {
            return res.status(400).json({ message: "Skills must be an array of up to 40 strings" });
          }
          user.skills = [...new Set(body.skills.map((skill) => skill.trim()).filter(Boolean))];
        }
      } else if (user.role === "recruiter") {
        if (body.company !== undefined) user.company = validateText(body.company, 120, "Company");
        if (body.companyProfile !== undefined) {
          if (!body.companyProfile || typeof body.companyProfile !== "object" || Array.isArray(body.companyProfile)) {
            return res.status(400).json({ message: "Company profile must be an object" });
          }
          for (const field of COMPANY_FIELDS) {
            if (body.companyProfile[field] === undefined) continue;
            user.companyProfile[field] = field === "website"
              ? validateUrl(body.companyProfile[field], "Website")
              : validateText(body.companyProfile[field], field === "description" ? 2000 : 100, field);
          }
        }
      } else {
        return res.status(403).json({ message: "This profile cannot be edited" });
      }

      await user.save();
      res.json({ message: "Profile updated" });
    } catch (err) {
      if (err.status === 400) return res.status(400).json({ message: err.message });
      return sendApiError(res, err);
    }
  });

  router.put("/me/resume", protect, authorize("student"), resumeStorageGate(config), parsePdf, async (req, res) => {
    if (rejectWhenResumeStorageDisabled(config, res)) return;
    let createdResume;
    let previousResumeId;
    let storageKey;
    try {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ message: "Upload a PDF resume" });
      }
      if (req.body.length > config.resumeMaxBytes) {
        return res.status(413).json({ message: "Resume exceeds the configured file-size limit" });
      }
      const pdfTail = req.body.subarray(Math.max(0, req.body.length - 1024));
      if (req.body.subarray(0, 5).toString("ascii") !== "%PDF-" || !pdfTail.includes(Buffer.from("%%EOF"))) {
        return res.status(415).json({ message: "Only PDF resumes are supported" });
      }

      const user = await User.findById(req.user._id);
      if (!user) return res.status(404).json({ message: "User not found" });
      previousResumeId = user.currentResume;
      storageKey = `${crypto.randomUUID()}.pdf`;
      const sha256 = crypto.createHash("sha256").update(req.body).digest("hex");
      await resumeStore.put(storageKey, req.body, sha256);

      let originalName = req.get("x-file-name");
      try {
        originalName = decodeURIComponent(originalName || "resume.pdf");
      } catch {
        originalName = "resume.pdf";
      }

      const resume = await Resume.create({
        owner: user._id,
        storageKey,
        originalName: safeOriginalName(originalName),
        mimeType: "application/pdf",
        size: req.body.length,
        sha256,
      });
      createdResume = resume;
      user.currentResume = resume._id;
      await user.save();

      if (previousResumeId && previousResumeId.toString() !== resume._id.toString()) {
        try {
          const previousResume = await Resume.findOne({ _id: previousResumeId, owner: user._id }).select("+storageKey");
          if (previousResume && !(await Application.exists({ resume: previousResume._id }))) {
            await resumeStore.delete(previousResume.storageKey);
            await previousResume.deleteOne();
          }
        } catch (cleanupError) {
          console.error("Previous resume cleanup failed", { name: cleanupError?.name || "Error" });
        }
      }

      res.status(201).json({
        _id: resume._id,
        originalName: resume.originalName,
        size: resume.size,
        createdAt: resume.createdAt,
      });
    } catch (err) {
      if (storageKey) await resumeStore.delete(storageKey).catch(() => {});
      if (createdResume) await createdResume.deleteOne().catch(() => {});
      return sendApiError(res, err);
    }
  });

  router.get("/me/resume", protect, authorize("student"), async (req, res) => {
    if (rejectWhenResumeStorageDisabled(config, res)) return;
    try {
      const user = await User.findById(req.user._id).select("currentResume");
      if (!user?.currentResume) return res.status(404).json({ message: "No current resume" });
      const resume = await Resume.findOne({ _id: user.currentResume, owner: req.user._id }).select("+storageKey");
      if (!resume) return res.status(404).json({ message: "Resume not found" });
      await sendResume(res, resume, resumeStore);
    } catch (err) {
      return sendApiError(res, err);
    }
  });

  router.delete("/me/resume", protect, authorize("student"), async (req, res) => {
    if (rejectWhenResumeStorageDisabled(config, res)) return;
    try {
      const user = await User.findById(req.user._id);
      if (!user?.currentResume) return res.status(404).json({ message: "No current resume" });
      const resume = await Resume.findOne({ _id: user.currentResume, owner: req.user._id }).select("+storageKey");
      if (!resume) return res.status(404).json({ message: "Resume not found" });
      if (await Application.exists({ resume: resume._id })) {
        return res.status(409).json({ message: "This resume is attached to application history and cannot be deleted" });
      }
      await resumeStore.delete(resume.storageKey);
      await resume.deleteOne();
      user.currentResume = null;
      await user.save();
      res.json({ message: "Resume deleted" });
    } catch (err) {
      return sendApiError(res, err);
    }
  });

  router.get("/me/resumes/:resumeId/download", protect, authorize("student"), async (req, res) => {
    if (rejectWhenResumeStorageDisabled(config, res)) return;
    try {
      if (!isValidObjectId(req.params.resumeId)) return res.status(400).json({ message: "Invalid resume ID" });
      const resume = await Resume.findOne({ _id: req.params.resumeId, owner: req.user._id }).select("+storageKey");
      if (!resume) return res.status(404).json({ message: "Resume not found" });
      await sendResume(res, resume, resumeStore);
    } catch (err) {
      return sendApiError(res, err);
    }
  });

  return router;
};

module.exports = createProfileRoutes;
