const express = require("express");
const Notification = require("../models/Notification");
const { protect } = require("../middleware/auth");
const { isValidObjectId, sendApiError } = require("../utils/apiErrors");

const router = express.Router();

router.get("/", protect, async (req, res) => {
  try {
    const filter = { user: req.user._id };
    if (req.query.unread === "true") filter.readAt = null;
    const notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(100);
    res.json(notifications);
  } catch (err) {
    return sendApiError(res, err);
  }
});

router.patch("/:id/read", protect, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid notification ID" });
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { $set: { readAt: new Date() } },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: "Notification not found" });
    res.json(notification);
  } catch (err) {
    return sendApiError(res, err);
  }
});

module.exports = router;