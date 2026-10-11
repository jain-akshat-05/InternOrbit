const Notification = require("../models/Notification");

const createNotification = async (io, data) => {
  const notification = await Notification.create(data);
  const event = {
    _id: notification._id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    application: notification.application,
    createdAt: notification.createdAt,
    readAt: notification.readAt,
  };
  io?.to(`user:${notification.user}`).emit("notification", event);
  return notification;
};

module.exports = { createNotification };