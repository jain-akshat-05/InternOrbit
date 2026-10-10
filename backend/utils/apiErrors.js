const mongoose = require("mongoose");

const isValidObjectId = (value) =>
  typeof value === "string" && mongoose.Types.ObjectId.isValid(value);

const sendApiError = (res, error) => {
  if (error?.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON request body" });
  }
  if (error?.code === 11000) {
    return res.status(409).json({ message: "A record with this value already exists" });
  }
  if (error?.name === "ValidationError") {
    return res.status(400).json({ message: "Invalid request data" });
  }
  if (error?.name === "CastError") {
    return res.status(400).json({ message: "Invalid resource identifier" });
  }

  console.error("Request failed", { name: error?.name || "Error", code: error?.code });
  return res.status(500).json({ message: "Internal server error" });
};

module.exports = { isValidObjectId, sendApiError };