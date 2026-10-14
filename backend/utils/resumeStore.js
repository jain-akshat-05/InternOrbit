const fs = require("node:fs/promises");
const {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} = require("@aws-sdk/client-s3");
const { getResumePath } = require("./resumeStorage");

const validateStorageKey = (storageKey) => {
  if (typeof storageKey !== "string" || !/^[a-f0-9-]{36}\.pdf$/i.test(storageKey)) {
    throw new Error("Invalid resume storage key");
  }
  return storageKey;
};

const readStream = async (stream, maxBytes) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > maxBytes) throw new Error("Stored resume exceeds the configured file-size limit");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, size);
};

const createResumeStore = (config, clientOverride) => {
  const provider = config.resumeStorageProvider || "local";
  if (provider === "disabled") {
    const unavailable = async () => {
      const error = new Error("Resume storage is temporarily disabled");
      error.status = 503;
      throw error;
    };
    return { put: unavailable, read: unavailable, delete: unavailable };
  }
  if (provider === "local") {
    return {
      async put(storageKey, contents) {
        const filePath = getResumePath(config.resumeStorageDir, storageKey);
        await fs.mkdir(config.resumeStorageDir, { recursive: true, mode: 0o700 });
        await fs.writeFile(filePath, contents, { flag: "wx", mode: 0o600 });
      },
      async read(storageKey) {
        return fs.readFile(getResumePath(config.resumeStorageDir, storageKey));
      },
      async delete(storageKey) {
        await fs.unlink(getResumePath(config.resumeStorageDir, storageKey)).catch((error) => {
          if (error.code !== "ENOENT") throw error;
        });
      },
    };
  }

  if (provider !== "s3" || !config.resumeS3) {
    throw new Error("S3 resume storage configuration is required");
  }

  const client = clientOverride || new S3Client({
    region: config.resumeS3.region,
    ...(config.resumeS3.endpoint ? { endpoint: config.resumeS3.endpoint } : {}),
    forcePathStyle: config.resumeS3.forcePathStyle,
    credentials: {
      accessKeyId: config.resumeS3.accessKeyId,
      secretAccessKey: config.resumeS3.secretAccessKey,
    },
  });
  const bucket = config.resumeS3.bucket;
  const maxBytes = config.resumeMaxBytes;

  return {
    async put(storageKey, contents, sha256) {
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: validateStorageKey(storageKey),
        Body: contents,
        ContentType: "application/pdf",
        Metadata: { sha256 },
      }));
    },
    async read(storageKey) {
      const result = await client.send(new GetObjectCommand({
        Bucket: bucket,
        Key: validateStorageKey(storageKey),
      }));
      if (!result.Body || result.ContentLength > maxBytes) {
        throw new Error("Stored resume is missing or exceeds the configured file-size limit");
      }
      return readStream(result.Body, maxBytes);
    },
    async delete(storageKey) {
      await client.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: validateStorageKey(storageKey),
      }));
    },
  };
};

module.exports = { createResumeStore };
