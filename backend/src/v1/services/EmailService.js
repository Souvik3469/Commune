import https from "https";

/**
 * Transactional OTP email via MSG91.
 *
 * The previous version registered no `error` listener on the request. An
 * unhandled `error` event on a Node stream is thrown, so a DNS failure or a
 * dropped connection to the mail provider took the whole API process down. It
 * also returned before the request completed, so callers could not tell
 * whether the mail was accepted.
 */
export function sendOTPEmail(otp, recipientEmail, recipientName) {
  return new Promise((resolve) => {
    if (!process.env.AUTH_KEY) {
      console.error("AUTH_KEY is not set; cannot send OTP email");
      return resolve(false);
    }

    const payload = JSON.stringify({
      recipients: [
        {
          to: [{ name: recipientName, email: recipientEmail }],
          variables: { name: recipientName, otp },
        },
      ],
      from: { name: "Commune", email: "mail@mail.commune.app" },
      domain: "mail.commune.app",
      template_id: "global_otp",
    });

    const req = https.request(
      {
        method: "POST",
        hostname: "control.msg91.com",
        path: "/api/v5/email/send",
        headers: {
          accept: "application/json",
          authkey: process.env.AUTH_KEY,
          "content-type": "application/json",
          "content-length": Buffer.byteLength(payload),
        },
        timeout: 10000,
      },
      (res) => {
        res.resume(); // drain, so the socket is released
        res.on("end", () => resolve(res.statusCode < 400));
      }
    );

    req.on("error", (err) => {
      console.error("Failed to send OTP email:", err.message);
      resolve(false);
    });
    req.on("timeout", () => {
      req.destroy();
      console.error("Timed out sending OTP email");
      resolve(false);
    });

    req.write(payload);
    req.end();
  });
}

export default sendOTPEmail;
