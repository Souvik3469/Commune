import otpGenerator from "otp-generator";

export const genOtp = () =>
  otpGenerator.generate(6, {
    upperCaseAlphabets: false,
    lowerCaseAlphabets: false,
    specialChars: false,
  });

// The mailer lives in ./sendEmail. A second, identical copy used to sit here,
// and the two files drifted independently.
export { sendEmail } from "./sendEmail";
