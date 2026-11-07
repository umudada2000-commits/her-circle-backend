import mongoose from "mongoose";

const ticketSchema = new mongoose.Schema(
  {
    ticketId: { type: String, unique: true, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    holderName: { type: String, required: true },
    status: {
      type: String,
      enum: ["valid", "checked_in", "cancelled"],
      default: "valid",
    },
    checkedInAt: { type: Date, default: null },
    purchasedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

ticketSchema.index({ userId: 1, eventId: 1 }, { unique: true });
// NO TTL index — tickets persist until manually deleted

export default mongoose.model("Ticket", ticketSchema);
