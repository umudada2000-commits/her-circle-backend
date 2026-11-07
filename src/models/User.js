import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    name: {
      type: String,
      default: ""
    },
    bio: {
      type: String,
      default: ""
    },
    avatar: {
      type: String,
      default: ""
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    role: {
      type: String,
      enum: ["member", "admin"],
      default: "member"
    },
    membershipTier: { type: String, enum: ["free", "plus"], default: "free" },
subscriptionExpiresAt: { type: Date, default: null 
    },
    otpHash: {
      type: String
    },
    otpExpires: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

const User = mongoose.model("User", userSchema);

export { User };
export default User;

