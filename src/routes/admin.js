import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import User from "../models/User.js";
import { authenticate, adminOnly } from "../middleware/auth.js";

const router = Router();

// Protect all admin endpoints with authentication and admin-only authorization
router.use(authenticate, adminOnly);

const updateRoleSchema = z.object({
  role: z.enum(["member", "admin"], {
    errorMap: () => ({ message: "Role must be 'member' or 'admin'" }),
  }),
});

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
 * GET /api/admin/users
 * Lists users with exclusion fields and pagination support (?page=1&limit=20)
 */
router.get("/users", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 20);
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find()
        .select("-passwordHash -otpHash -otpExpires -__v")
        .skip(skip)
        .limit(limit),
      User.countDocuments(),
    ]);

    const formattedUsers = users.map(formatUser);

    res.set({
      "X-Total-Count": total.toString(),
      "X-Page": page.toString(),
      "X-Limit": limit.toString(),
      "X-Total-Pages": Math.ceil(total / limit).toString(),
    });

    return res.json(formattedUsers);
  } catch (error) {
    console.error("[GET /api/admin/users] Error:", error.message);
    return res.status(500).json({ message: error.message || "Failed to fetch users" });
  }
});

/**
 * PATCH /api/admin/users/:id/role
 * Updates role of the target user
 */
router.patch("/users/:id/role", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: "User not found" });
    }

    const validation = updateRoleSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        message: "Validation error",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    targetUser.role = validation.data.role;
    await targetUser.save();

    return res.json(formatUser(targetUser));
  } catch (error) {
    console.error("[PATCH /api/admin/users/:id/role] Error:", error.message);
    return res.status(500).json({ message: error.message || "Failed to update user role" });
  }
});

export { router };
export default router;

