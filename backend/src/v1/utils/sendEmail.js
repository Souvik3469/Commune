const nodemailer = require("nodemailer");
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
    console.log(error.message, "err  node mailer");
  }
};
module.exports = { sendEmail };