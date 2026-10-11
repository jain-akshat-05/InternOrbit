const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { getResumePath, safeOriginalName } = require("../utils/resumeStorage");

test("resume storage keys resolve only to generated PDF filenames", () => {
  const directory = path.resolve("test-resumes");
  const filePath = getResumePath(directory, "550e8400-e29b-41d4-a716-446655440000.pdf");
  assert.equal(path.dirname(filePath), directory);
  assert.throws(() => getResumePath(directory, "../private.pdf"), /Invalid resume storage key/);
  assert.throws(() => getResumePath(directory, "resume.pdf"), /Invalid resume storage key/);
});

test("original resume names are reduced to safe PDF basenames", () => {
  assert.equal(safeOriginalName("..\\..\\resume final.pdf"), "resume_final.pdf");
  assert.equal(safeOriginalName("not-a-pdf.txt"), "resume.pdf");
});