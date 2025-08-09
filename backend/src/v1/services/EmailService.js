const http = require("https");

export function sendOTPEmail(otp, recipientEmail, recipientName) {
  const options = {
    method: "POST",
    hostname: "control.msg91.com",
    port: null,
    path: "/api/v5/email/send",
    headers: {
      accept: "application/json",
      authkey: process.env.AUTH_KEY, 
      "content-type": "application/JSON"
    }
  };
  const req = http.request(options, function (res) {
    const chunks = [];
    res.on("data", function (chunk) {
      chunks.push(chunk);
    });
    res.on("end", function () {
      const body = Buffer.concat(chunks);
      // console.log(body.toString());
    });
  });
  const emailData = {
    recipients: [
      {
        to: [
          {
            name: recipientName,
            email: recipientEmail,
          },
        ],
        variables: {
          name: recipientName,
          otp: otp,
        },
      },
    ],
    from: {
      name: "Commune",
      email: "mail@mail.commune.app",
    },
    domain: "mail.commune.app",
    template_id: "global_otp",
  };
  req.write(JSON.stringify(emailData));
  req.end();
}
