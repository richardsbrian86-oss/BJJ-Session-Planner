import rateLimit from "express-rate-limit";

export const instructorLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => String(req.instructorId!),
  message: { error: "Too many requests. Please try again later." },
});

export const clientLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => String(req.clientId!),
  message: { error: "Too many requests. Please try again later." },
});
