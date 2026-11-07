import { Router } from "express";
import crypto from "crypto";
import Ticket from "../models/Ticket.js";
import Event from "../models/Event.js";
import User from "../models/User.js";
import { authenticate, adminOnly } from "../middleware/auth.js";

const router = Router();

const PAYSTACK_BASE = "https://api.paystack.co";

function generateTicketId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[crypto.randomInt(0, chars.length)];
  }
  return `HC-${code}`;
}

function computeExpiresAt(event) {
  const base = event.endDate || event.startDate;
  if (!base) {
    const fallback = new Date();
    fallback.setHours(fallback.getHours() + 24);
    return fallback;
  }
  const exp = new Date(base);
  exp.setHours(exp.getHours() + 24);
  return exp;
}

function effectiveStatus(ticket) {
  if (ticket.status === "checked_in") return "checked_in";
  if (ticket.status === "cancelled") return "cancelled";
  if (ticket.expiresAt && new Date(ticket.expiresAt) < new Date()) return "expired";
  return "valid";
}

function formatTicket(t) {
  return {
    id: t._id,
    ticketId: t.ticketId,
    holderName: t.holderName,
    status: t.status,
    effectiveStatus: effectiveStatus(t),
    checkedInAt: t.checkedInAt,
    purchasedAt: t.purchasedAt,
    expiresAt: t.expiresAt,
    event: t.eventId
      ? {
          id: t.eventId._id,
          title: t.eventId.title,
          location: t.eventId.location,
          startDate: t.eventId.startDate,
          endDate: t.eventId.endDate,
          ticketPrice: t.eventId.ticketPrice || 0,
        }
      : null,
  };
}

async function paystackInitialize({ email, amountKobo, callbackUrl, metadata }) {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: amountKobo,
      currency: "NGN",
      callback_url: callbackUrl,
      metadata,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.status) throw new Error(data.message || "Paystack initialize failed");
  return data.data;
}

async function paystackVerify(reference) {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
  });
  const data = await res.json();
  if (!res.ok || !data.status) throw new Error(data.message || "Paystack verify failed");
  return data.data;
}

router.post("/initialize", authenticate, async (req, res) => {
  try {
    const { eventId } = req.body;
    if (!eventId) return res.status(400).json({ message: "eventId is required" });

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });

    // Block if event has already ended (past expiry)
    const expiresAt = computeExpiresAt(event);
    if (expiresAt < new Date()) {
      return res.status(400).json({ message: "This event has already ended" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const existing = await Ticket.findOne({ userId: user._id, eventId });
    if (existing) {
      return res.status(409).json({
        message: "You already have a ticket for this event",
        ticketId: existing.ticketId,
      });
    }

    const price = Number(event.ticketPrice) || 0;

    if (price === 0) {
      const ticket = new Ticket({
        ticketId: generateTicketId(),
        userId: user._id,
        eventId,
        holderName: user.name || user.email || user.phone || "Guest",
        expiresAt,
      });
      await ticket.save();
      return res.status(201).json({ ticketId: ticket.ticketId, paid: false });
    }

    if (!user.email) {
      return res.status(400).json({ message: "Email is required for paid tickets" });
    }

    const transaction = await paystackInitialize({
      email: user.email,
      amountKobo: Math.round(price * 100),
      callbackUrl: `${process.env.CLIENT_URL}/payment/ticket-callback`,
      metadata: {
        type: "ticket",
        eventId: event._id.toString(),
        userId: user._id.toString(),
        eventTitle: event.title,
      },
    });

    return res.status(200).json({
      authorizationUrl: transaction.authorization_url,
      paid: true,
    });
  } catch (err) {
    console.error("[POST /tickets/initialize]", err.message);
    return res.status(500).json({ message: err.message || "Failed to initialize ticket" });
  }
});

router.post("/verify", authenticate, async (req, res) => {
  try {
    const { reference } = req.body;
    if (!reference) return res.status(400).json({ message: "reference is required" });

    const tx = await paystackVerify(reference);
    if (tx.status !== "success") {
      return res.status(400).json({ message: "Payment was not successful" });
    }

    const meta = tx.metadata || {};
    if (meta.type !== "ticket") return res.status(400).json({ message: "Invalid payment type" });
    if (meta.userId !== req.user.id) return res.status(403).json({ message: "Payment belongs to another user" });

    const event = await Event.findById(meta.eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const existing = await Ticket.findOne({ userId: user._id, eventId: event._id });
    if (existing) return res.json({ ticketId: existing.ticketId });

    const expectedAmount = Math.round((Number(event.ticketPrice) || 0) * 100);
    if (expectedAmount > 0 && tx.amount !== expectedAmount) {
      return res.status(400).json({ message: "Payment amount does not match ticket price" });
    }

    const ticket = new Ticket({
      ticketId: generateTicketId(),
      userId: user._id,
      eventId: event._id,
      holderName: user.name || user.email || user.phone || "Guest",
      expiresAt: computeExpiresAt(event),
    });
    await ticket.save();

    return res.json({ ticketId: ticket.ticketId });
  } catch (err) {
    console.error("[POST /tickets/verify]", err.message);
    return res.status(500).json({ message: err.message || "Failed to verify payment" });
  }
});

router.get("/my", authenticate, async (req, res) => {
  try {
    const tickets = await Ticket.find({ userId: req.user.id })
      .populate("eventId")
      .sort({ purchasedAt: -1 });
    res.json(tickets.map(formatTicket));
  } catch (err) {
    console.error("[GET /tickets/my]", err.message);
    res.status(500).json({ message: "Failed to load tickets" });
  }
});

router.get("/:ticketId", async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId })
      .populate("eventId")
      .populate("userId", "name email");
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    res.json(formatTicket(ticket));
  } catch (err) {
    console.error("[GET /tickets/:ticketId]", err.message);
    res.status(500).json({ message: "Failed to load ticket" });
  }
});

router.post("/:ticketId/check-in", authenticate, adminOnly, async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    if (ticket.status === "checked_in") {
      return res.status(409).json({ message: "Already checked in", checkedInAt: ticket.checkedInAt });
    }
    if (ticket.status === "cancelled") {
      return res.status(400).json({ message: "Ticket was cancelled" });
    }
    if (ticket.expiresAt && new Date(ticket.expiresAt) < new Date()) {
      return res.status(400).json({ message: "This ticket has expired" });
    }

    ticket.status = "checked_in";
    ticket.checkedInAt = new Date();
    await ticket.save();

    res.json({ message: "Checked in", ticketId: ticket.ticketId, checkedInAt: ticket.checkedInAt });
  } catch (err) {
    console.error("[POST /tickets/:id/check-in]", err.message);
    res.status(500).json({ message: "Failed to check in" });
  }
});

// DELETE  user deletes own ticket; admin can delete any
router.delete("/:ticketId", authenticate, async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    if (req.user.role !== "admin" && ticket.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: "You can only delete your own tickets" });
    }

    await Ticket.deleteOne({ _id: ticket._id });
    res.json({ message: "Ticket deleted" });
  } catch (err) {
    console.error("[DELETE /tickets/:ticketId]", err.message);
    res.status(500).json({ message: "Failed to delete ticket" });
  }
});

export { router };
export default router;
