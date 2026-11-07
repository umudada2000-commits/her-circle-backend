import { Router } from "express";
import Event from "../models/Event.js";
import { authenticate, adminOnly } from "../middleware/auth.js";

const router = Router();

router.get("/", authenticate, async (req, res) => {
  try {
    const events = await Event.find().sort({ startDate: 1 });
    res.json(
      events.map((ev) => ({
        id: ev._id,
        title: ev.title,
        description: ev.description,
        startDate: ev.startDate,
        endDate: ev.endDate,
        location: ev.location,
        ticketPrice: ev.ticketPrice || 0,
        createdBy: ev.createdBy,
        createdAt: ev.createdAt,
      }))
    );
  } catch (err) {
    console.error("[GET /events]", err.message);
    res.status(500).json({ message: "Failed to load events" });
  }
});

router.post("/", authenticate, adminOnly, async (req, res) => {
  try {
    const { title, description, startDate, endDate, location, ticketPrice } = req.body;
    if (!title || !startDate) {
      return res.status(400).json({ message: "title and startDate are required" });
    }

    const price = Number(ticketPrice) || 0;
    if (price < 0) {
      return res.status(400).json({ message: "ticketPrice must be zero or positive" });
    }

    const event = new Event({
      title,
      description: description || "",
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : undefined,
      location: location || "",
      ticketPrice: price,
      createdBy: req.user.id,
    });
    await event.save();

    res.status(201).json({
      id: event._id,
      title: event.title,
      description: event.description,
      startDate: event.startDate,
      endDate: event.endDate,
      location: event.location,
      ticketPrice: event.ticketPrice,
      createdBy: event.createdBy,
    });
  } catch (err) {
    console.error("[POST /events]", err.message);
    res.status(500).json({ message: err.message || "Failed to create event" });
  }
});

router.delete("/:id", authenticate, adminOnly, async (req, res) => {
  try {
    const deleted = await Event.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Event not found" });
    res.json({ message: "Event deleted successfully" });
  } catch (err) {
    console.error("[DELETE /events/:id]", err.message);
    res.status(500).json({ message: "Failed to delete event" });
  }
});

export { router };
export default router;
