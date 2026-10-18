import rateLimit from "express-rate-limit";

const minutes = (n) => n * 60 * 1000;

const keyByEmailOrIp = (req) => {
  const email = req.body?.email || req.query?.email;
  return email ? `email:${String(email).toLowerCase()}` : req.ip;
};

const json = (message) => (req, res) => res.status(429).json({ message });

/**
 * Baseline budget for ordinary reads. The app previously ran a single
 * 1000-per-15-minutes limiter across every route, which meant the login and
 * password-reset endpoints shared their budget with message polling — roughly a
 * thousand password guesses per window.
 */
export const generalLimiter = rateLimit({
  windowMs: minutes(15),
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json("Too many requests. Please slow down."),
});

/** Login and registration, keyed on the email being targeted. */
export const authLimiter = rateLimit({
  windowMs: minutes(15),
  max: 10,
  keyGenerator: keyByEmailOrIp,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json("Too many attempts. Please try again in a few minutes."),
});

/** OTP and reset-code verification — the brute-forceable surfaces. */
export const otpLimiter = rateLimit({
  windowMs: minutes(15),
  max: 5,
  keyGenerator: keyByEmailOrIp,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json("Too many code attempts. Please request a new code."),
});

/** Outbound email, so the service cannot be used as a mail cannon. */
export const emailLimiter = rateLimit({
  windowMs: minutes(60),
  max: 5,
  keyGenerator: keyByEmailOrIp,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json("Too many emails requested. Please try again later."),
});
