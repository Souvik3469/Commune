const http = require("https");

export function sendOTPEmail(otp, recipientEmail, recipientName) {
  const options = {
    method: "POST",
    hostname: "control.msg91.com",
    port: null,
    path: "/api/v5/email/send",
    headers: {
      accept: "application/json",
      authkey: "429576Ad3trg3tn66d9b0f8P1", 
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
      console.log(body.toString());
    });
  });

  const emailData = {
    recipients: [
      {
        to: [
          {
            name: recipientName,
            email: recipientEmail
          }
        ],
        variables: {
          name: recipientName,
          otp: otp
        }
      }
    ],
    from: {
      name: "Duocortex",
      email: "mail@mail.duocortex.app"
    },
    domain: "mail.duocortex.app",
    template_id: "global_otp"
  };

  // Sending the request
  req.write(JSON.stringify(emailData));
  req.end();
}

