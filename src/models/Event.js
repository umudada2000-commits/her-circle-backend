import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    location: { type: String, default: "", trim: true },
    ticketPrice: { type: Number, default: 0, min: 0 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Event", eventSchema);
