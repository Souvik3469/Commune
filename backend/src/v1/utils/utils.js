const nodemailer = require("nodemailer");
const otpGenerator = require("otp-generator");
const genOtp = () => {
  const otp = otpGenerator.generate(6, {
    upperCaseAlphabets: false,
    lowerCaseAlphabets: false,
    specialChars: false,
  });
  return otp;
};

const sendEmail = async (email, title, body) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL,
        pass: process.env.PASS,
      },
    });

    let info = await transporter.sendMail({
      from: "commune@gmail.com",
      to: email,
      subject: title,
      html: body,
    });
    return info;
  } catch (error) {
    console.log(error.message, "err  node mailker");
  }
};

module.exports = { sendEmail, genOtp };
