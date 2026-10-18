import nodemailer from "nodemailer";

/**
 * One transporter for the process. A fresh one was previously built per call,
 * which reopens the SMTP connection on every email.
 */
let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL, pass: process.env.PASS },
    });
  }
  return transporter;
};

/**
 * Returns true when the message was handed to the SMTP server, false when it
 * was not. The old version caught its own errors and returned undefined, so
 * callers reported success for mail that never left the process.
 */
export const sendEmail = async (email, title, body) => {
  try {
    await getTransporter().sendMail({
      from: process.env.EMAIL || "commune@gmail.com",
      to: email,
      subject: title,
      html: body,
    });
    return true;
  } catch (error) {
    console.error("Failed to send email:", error.message);
    return false;
  }
};

export default sendEmail;
