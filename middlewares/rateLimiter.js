import rateLimit from "express-rate-limit";

/* 🔐 Global API limiter */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,               // 300 requests per IP
  message: {
    success: false,
    message: "Too many requests, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/* 🔑 Strict limiter for login & auth */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // only 10 login attempts per 15 min
  message: {
    success: false,
    message: "Too many login attempts. Try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
