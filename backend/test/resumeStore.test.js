const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const test = require("node:test");
const { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { createResumeStore } = require("../utils/resumeStore");

const config = (maxBytes = 64) => ({
  resumeStorageProvider: "s3",
  resumeMaxBytes: maxBytes,
  resumeS3: { bucket: "private-resumes", region: "us-east-1", accessKeyId: "test-access-key", secretAccessKey: "test-secret-key", forcePathStyle: false },
});
const key = "550e8400-e29b-41d4-a716-446655440000.pdf";

test("S3 resume store writes private PDF metadata, reads bytes, and deletes by generated key", async () => {
  const commands = [];
  const contents = Buffer.from("%PDF-1.7\nresume\n%%EOF");
  const client = {
    async send(command) {
      commands.push(command);
      if (command instanceof GetObjectCommand) return { ContentLength: contents.length, Body: Readable.from([contents]) };
      return {};
    },
  };
  const store = createResumeStore(config(), client);
  await store.put(key, contents, "a".repeat(64));
  assert.ok(commands[0] instanceof PutObjectCommand);
  assert.equal(commands[0].input.ContentType, "application/pdf");
  assert.equal(commands[0].input.Metadata.sha256, "a".repeat(64));
  assert.equal("ACL" in commands[0].input, false);
  assert.deepEqual(await store.read(key), contents);
  await store.delete(key);
  assert.ok(commands[2] instanceof DeleteObjectCommand);
  assert.equal(commands.every((command) => command.input.Bucket === "private-resumes"), true);
});

test("S3 resume store rejects invalid keys and oversized stored objects", async () => {
  let sent = 0;
  const contents = Buffer.from("123456789");
  const client = { async send(command) { sent += 1; return { ContentLength: contents.length, Body: Readable.from([contents]) }; } };
  const store = createResumeStore(config(8), client);
  await assert.rejects(store.read("../resume.pdf"), /Invalid resume storage key/);
  await assert.rejects(store.read(key), /exceeds the configured file-size limit/);
  assert.equal(sent, 1);
});

test("disabled resume store returns 503 errors without falling back to disk", async () => {
  const store = createResumeStore({ resumeStorageProvider: "disabled" });
  for (const operation of [
    () => store.put(key, Buffer.from("pdf")),
    () => store.read(key),
    () => store.delete(key),
  ]) {
    await assert.rejects(operation(), (error) => error.status === 503);
  }
});
