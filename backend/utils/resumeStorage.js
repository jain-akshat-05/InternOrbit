const path = require("node:path");

const getResumePath = (storageDir, storageKey) => {
  if (typeof storageKey !== "string" || !/^[a-f0-9-]{36}\.pdf$/i.test(storageKey)) {
    throw new Error("Invalid resume storage key");
  }

  const resolvedDirectory = path.resolve(storageDir);
  const resolvedFile = path.resolve(resolvedDirectory, storageKey);
  if (path.dirname(resolvedFile) !== resolvedDirectory) {
    throw new Error("Invalid resume storage path");
  }
  return resolvedFile;
};

const safeOriginalName = (value) => {
  const baseName = path.basename(String(value || "resume.pdf").replace(/\\/g, "/"));
  const safeName = baseName.replace(/[^a-zA-Z0-9._()-]/g, "_").slice(0, 180);
  return safeName.toLowerCase().endsWith(".pdf") ? safeName : "resume.pdf";
};

module.exports = { getResumePath, safeOriginalName };