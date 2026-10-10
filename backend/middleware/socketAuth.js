const jwt = require("jsonwebtoken");

const createSocketAuth = (secret) => (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Not authorized"));

    const decoded = jwt.verify(token, secret);
    if (typeof decoded.id !== "string" || !decoded.id) {
      return next(new Error("Not authorized"));
    }

    socket.data.userId = decoded.id;
    next();
  } catch {
    next(new Error("Not authorized"));
  }
};

module.exports = createSocketAuth;