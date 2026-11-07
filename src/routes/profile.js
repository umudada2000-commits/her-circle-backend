import { Router } from "express";
import { z } from "zod";
import User from "../models/User.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// Protect all profile endpoints with authentication
router.use(authenticate);

// Zod schema for updating profile fields
const updateProfileSchema = z.object({
  name: z.string().trim().max(100, "Name cannot exceed 100 characters").optional(),
  bio: z.string().trim().max(500, "Bio cannot exceed 500 characters").optional(),
  avatar: z.string().trim().max(2048, "Avatar URL cannot exceed 2048 characters").optional(),
});

// Helper to format user response excluding sensitive/internal fields
const formatUser = (user) => ({
  id: user._id,
  email: user.email,
  phone: user.phone,
  name: user.name,
  bio: user.bio,
  avatar: user.avatar,
  isVerified: user.isVerified,
  role: user.role,
  membershipTier: user.membershipTier,
  createdAt: user.createdAt,
});

/**
 * GET /api/profile
 * Returns the currently authenticated user's profile
 */
router.get("/", async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "-passwordHash -otpHash -otpExpires -__v"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(formatUser(user));
  } catch (error) {
    console.error("[GET /api/profile] Error:", error.message);
    return res.status(500).json({ message: error.message || "Failed to fetch profile" });
  }
});

/**
 * PATCH /api/profile
 * Updates optional profile fields (name, bio, avatar)
 */
router.patch("/", async (req, res) => {
  try {
    const validation = updateProfileSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        message: "Validation error",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { name, bio, avatar } = validation.data;
    if (name !== undefined) user.name = name;
    if (bio !== undefined) user.bio = bio;
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();

    return res.json(formatUser(user));
  } catch (error) {
    console.error("[PATCH /api/profile] Error:", error.message);
    return res.status(500).json({ message: error.message || "Failed to update profile" });
  }
});

export { router };
export default router;

