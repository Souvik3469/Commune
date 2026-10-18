/**
 * Unit tests for the pieces of the fix that can be exercised without a
 * database: token issuing and verification, the public-user projection, and
 * the compound message cursor.
 *
 * Run against the Babel output: `npm run build && npm test`.
 */
import test from "node:test";
import assert from "node:assert/strict";

process.env.USER_ACCESS_SECRET = "test-secret";

const { signAccessToken, userIdFromToken, bearerFromHeader } = await import(
  "../build/v1/utils/tokens.js"
);
const { publicUser } = await import("../build/v1/utils/publicUser.js");
const jwt = (await import("jsonwebtoken")).default;

test("access tokens", async (t) => {
  await t.test("round-trips a user id", () => {
    assert.equal(userIdFromToken(signAccessToken("abc123")), "abc123");
  });

  await t.test("carry an expiry — they used to be eternal", () => {
    const decoded = jwt.decode(signAccessToken("abc123"));
    assert.ok(decoded.exp, "token has no exp claim");
    assert.ok(decoded.exp > decoded.iat);
  });

  await t.test("still accept the legacy bare-string payload", () => {
    assert.equal(
      userIdFromToken(jwt.sign("legacy-id", "test-secret")),
      "legacy-id"
    );
  });

  await t.test("reject a token signed with another secret", () => {
    assert.equal(userIdFromToken(jwt.sign({ sub: "x" }, "other")), null);
  });

  await t.test("reject an expired token", () => {
    const expired = jwt.sign({ sub: "x", typ: "access" }, "test-secret", {
      expiresIn: -10,
    });
    assert.equal(userIdFromToken(expired), null);
  });

  await t.test("reject garbage and empty values", () => {
    [null, undefined, "", "not.a.token", 42].forEach((value) =>
      assert.equal(userIdFromToken(value), null)
    );
  });
});

test("bearer header parsing", async (t) => {
  await t.test("parses a well-formed header", () => {
    assert.equal(bearerFromHeader("Bearer abc"), "abc");
    assert.equal(bearerFromHeader("bearer abc"), "abc");
  });

  await t.test("rejects malformed headers rather than yielding undefined", () => {
    ["Bearer", "abc", "", null, "Basic abc"].forEach((value) =>
      assert.equal(bearerFromHeader(value), null)
    );
  });
});

test("public user projection", async (t) => {
  await t.test("strips the password hash and the live reset code", () => {
    const safe = publicUser({
      id: "1",
      name: "Souvik",
      email: "s@example.com",
      password: "$2b$10$hash",
      resetPasswordToken: "123456",
      resetPasswordExpiry: new Date(),
      resetPasswordTries: 2,
      googleId: "g",
    });
    [
      "password",
      "resetPasswordToken",
      "resetPasswordExpiry",
      "resetPasswordTries",
      "googleId",
    ].forEach((field) => assert.ok(!(field in safe), `${field} leaked`));
    assert.equal(safe.name, "Souvik");
    assert.equal(safe.email, "s@example.com");
  });

  await t.test("does not mutate its input", () => {
    const input = { id: "1", password: "hash" };
    publicUser(input);
    assert.equal(input.password, "hash");
  });
});

/** Mirrors the cursor handling in getMessagesByChat. */
const decodeCursor = (cursor) => {
  const separator = String(cursor).lastIndexOf("_");
  const rawTimestamp =
    separator === -1 ? String(cursor) : String(cursor).slice(0, separator);
  const id = separator === -1 ? null : String(cursor).slice(separator + 1);
  const parsed = new Date(rawTimestamp);
  return { timestamp: parsed, id, valid: !Number.isNaN(parsed.getTime()) };
};

test("compound message cursor", async (t) => {
  await t.test("round-trips a timestamp and an ObjectId", () => {
    const timestamp = new Date("2026-10-18T04:15:30.123Z");
    const id = "671f3a9b2c4d5e6f70819293";
    const decoded = decodeCursor(`${timestamp.toISOString()}_${id}`);
    assert.ok(decoded.valid);
    assert.equal(decoded.timestamp.toISOString(), timestamp.toISOString());
    assert.equal(decoded.id, id);
  });

  await t.test("still reads a legacy timestamp-only cursor", () => {
    const timestamp = new Date("2026-10-18T04:15:30.123Z");
    const decoded = decodeCursor(timestamp.toISOString());
    assert.ok(decoded.valid);
    assert.equal(decoded.id, null);
    assert.equal(decoded.timestamp.toISOString(), timestamp.toISOString());
  });

  await t.test("flags a malformed cursor instead of paging from epoch", () => {
    assert.equal(decodeCursor("garbage_abc").valid, false);
  });
});
