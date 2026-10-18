import jwt from "jsonwebtoken";

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "7d";

const secret = () => {
  const value = process.env.USER_ACCESS_SECRET;
  if (!value) {
    throw new Error("USER_ACCESS_SECRET is not set");
  }
  return value;
};

/**
 * Access tokens used to be `jwt.sign(user.id, secret)` — a bare string payload,
 * which cannot carry an `exp` claim, so every token ever issued was valid
 * forever. They are objects now so they can expire.
 */
export const signAccessToken = (userId) =>
  jwt.sign({ sub: userId, typ: "access" }, secret(), {
    expiresIn: ACCESS_TOKEN_TTL,
  });

/**
 * Returns the user id for a token, or null if the token is unusable.
 * Accepts the legacy bare-string payload so tokens issued before this change
 * keep working until they are replaced on next login.
 */
export const userIdFromToken = (token) => {
  if (!token || typeof token !== "string") return null;
  try {
    const decoded = jwt.verify(token, secret());
    if (typeof decoded === "string") return decoded; // legacy
    if (decoded && typeof decoded === "object") {
      if (decoded.typ && decoded.typ !== "access") return null;
      return decoded.sub || decoded.userId || null;
    }
    return null;
  } catch {
    return null;
  }
};

export const bearerFromHeader = (authHeader) => {
  if (!authHeader || typeof authHeader !== "string") return null;
  const [scheme, value] = authHeader.split(" ");
  if (!value || scheme.toLowerCase() !== "bearer") return null;
  return value.trim() || null;
};
