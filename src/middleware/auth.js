import jwt from "jsonwebtoken";

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be defined in production environment");
  }
  return secret || "her_circle_jwt_dev_secret";
};

/**
 * Authentication middleware that verifies JWT from Authorization header.
 * Attaches decoded payload { id, role } to req.user.
 */
export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.user = {
      id: decoded.id,
      role: decoded.role,
    };
    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

/**
 * Authorization middleware for admin-only routes.
 * Must run after authenticate middleware.
 */
export const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};

export default {
  authenticate,
  adminOnly,
};

