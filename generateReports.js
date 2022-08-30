const { Account, Analysis, Device, Services, Utils } = require("@tago-io/sdk");

function validation(validation_var, device) {
  return function _(message, type) {
    if (!message || !type) {
      throw "Missing message or type";
    }
    device
      .sendData({
        variable: validation_var,
        value: message,
        metadata: {
          type,
        },
      })
      .then(console.log);
  };
}

async function sendReport(context, scope, account, device, email) {
  const data = await device.getData({ variable: ["temperature", "humidity"], start_date: "10 year", qty: 9999 });
  let csv = "variable,value,unit,time";

  data.forEach((x) => {
    csv = `${csv}\n${x.variable},${x.value},${x.unit},${x.time}`;
  });
  const emailService = new Services({ token: context.token }).email;
  const from = "reports@tago.io";
  const subject = "Tago report";
  const message = `Hi, this is an example of a report.`;
  const attachment = {
    archive: csv,
    filename: "report.csv",
  };
  //   { to: "client(at)company.com", subject: "Reports", message: "Hello client, it's your report" }
  console.log(email);
  await emailService.send({ to: email.value, from, subject, attachment, message });
}

async function explore(context, scope) {
  if (!scope[0]) {
    return context.log("no scope");
  }
  const env_var = Utils.envToJson(context.environment);
  if (!env_var.account_token) {
    return context.log("Can't find variable account_token on environment variables");
  }
  if (!env_var.device_token) {
    return context.log("Can't find variable device_token on environment variables");
  }
  if (!env_var.dashboard_id) {
    return context.log("Can't find variable dashboard_id on environment variables");
  }

  const tago_acc = new Account({ token: env_var.account_token });
  const tago_device = new Device({ token: env_var.device_token });

  const customer_email = scope.find((x) => x.variable === "email");
  console.log(customer_email);
  if (customer_email) {
    const token = await Utils.getTokenByName(tago_acc, customer_email.device);
    const device_data = new Device({ token: token });
    const validate = validation("validation", device_data);
    validate("Generating report, please wait a moment...", "success");
    await sendReport(context, scope, tago_acc, tago_device, customer_email);
    validate("Report successfully generated, please check your email.", "success");
    return;
  } else{
    return validate("No email address provided.", "danger");
  }
}

module.exports = new Analysis(explore);

// To run analysis on your machine (external)
// module.exports = new Analysis(explore, { token: "8142d7d6-310c-4512-b86b-8fba9adc319a" });
