import assert from "node:assert/strict";
import test from "node:test";
import { isPdfResume } from "./resumeValidation.js";

test("accepts PDF files when browser MIME metadata is present or empty", () => {
  assert.equal(isPdfResume({ name: "resume.pdf", type: "application/pdf" }), true);
  assert.equal(isPdfResume({ name: "resume.PDF", type: "" }), true);
});

test("rejects non-PDF filenames and mismatched MIME types", () => {
  assert.equal(isPdfResume({ name: "resume.docx", type: "application/pdf" }), false);
  assert.equal(isPdfResume({ name: "resume.pdf", type: "text/plain" }), false);
  assert.equal(isPdfResume(null), false);
});
