import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import User from "../models/User.js";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many attempts from this IP, please try again after 10 minutes",
  },
});

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be defined in production environment");
  }
  return secret || "her_circle_jwt_dev_secret";
};

const signupSchema = z
  .object({
    email: z.string().email("Invalid email format").optional().or(z.literal("")),
    phone: z.string().trim().min(5, "Phone number must be at least 5 characters").optional().or(z.literal("")),
    password: z.string().min(8, "Password must be at least 8 characters long"),
  })
  .refine(
    (data) => Boolean((data.email && data.email.trim()) || (data.phone && data.phone.trim())),
    {
      message: "At least one of email or phone is required",
      path: ["identifier"],
    }
  );

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Identifier (email or phone) is required"),
  password: z.string().min(1, "Password is required"),
});

router.post("/signup", authLimiter, async (req, res) => {
  try {
    const validation = signupSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        message: "Validation error",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const { email, phone, password } = validation.data;
    const cleanEmail = email && email.trim() ? email.toLowerCase().trim() : undefined;
    const cleanPhone = phone && phone.trim() ? phone.trim() : undefined;

    const queryConditions = [];
    if (cleanEmail) queryConditions.push({ email: cleanEmail });
    if (cleanPhone) queryConditions.push({ phone: cleanPhone });

    const existingUser = await User.findOne({ $or: queryConditions });
    if (existingUser) {
      return res.status(409).json({ message: "An account with this email or phone already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = new User({
  ...(cleanEmail ? { email: cleanEmail } : {}),
  ...(cleanPhone ? { phone: cleanPhone } : {}),
  passwordHash,
  isVerified: true,
  membershipTier: "plus",
});
    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role },
      getJwtSecret(),
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    return res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
        name: user.name,
        bio: user.bio,
        avatar: user.avatar,
        membershipTier: user.membershipTier,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("[POST /signup] Error:", error.message);
    return res.status(500).json({ message: error.message || "Failed to process signup" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        message: "Validation error",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const { identifier, password } = validation.data;
    const cleanIdentifier = identifier.trim();

    const user = await User.findOne({
      $or: [
        { email: cleanIdentifier.toLowerCase() },
        { phone: cleanIdentifier },
      ],
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      getJwtSecret(),
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    return res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
        name: user.name,
        bio: user.bio,
        avatar: user.avatar,
        membershipTier: user.membershipTier,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("[POST /login] Error:", error.message);
    return res.status(500).json({ message: error.message || "Failed to log in" });
  }
});

export { router };
export default router;