const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }

  let decoded;
  try {
    const token = authHeader.split(" ")[1];
    decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || typeof decoded.id !== "string") {
      return res.status(401).json({ message: "Not authorized, token failed" });
    }
  } catch {
    return res.status(401).json({ message: "Not authorized, token failed" });
  }

  try {
    req.user = await User.findById(decoded.id).select("-password");
    if (!req.user) return res.status(401).json({ message: "User no longer exists" });
    next();
  } catch (err) {
    next(err);
  }
};

// usage: authorize("recruiter", "admin")
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: `Role '${req.user.role}' is not allowed to access this resource` });
    }
    next();
  };
};

module.exports = { protect, authorize };
