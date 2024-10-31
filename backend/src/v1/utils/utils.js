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
      from: "banerjeeankush184@gmail.com",
      to: email,
      subject: title,
      html: body,
    });
    console.log("Email info: ", info);
    return info;
  } catch (error) {
    console.log(error.message, "err  node mailker");
  }
};
module.exports = { sendEmail, genOtp };
