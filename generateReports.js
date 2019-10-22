const TagoAnalysis = require('tago/analysis');
const TagoDevice = require('tago/device');
const TagoUtils = require('tago/utils');
const TagoAccount = require('tago/account');
const TagoServices = require('tago/services');
const co = require('co');

function validation(validation_var, device) {
  return function _(message, type) {
    if (!message || !type) throw 'Missing message or type';
    device.insert({
      variable: validation_var,
      value: message,
      metadata: {
        type,
      },
    }).then(console.log);
  };
}

async function sendReport(context, scope, account, device, email) {
  const account_info = await account.info();
  const data = await device.find({ variable: ['temperature', 'humidity'], start_date: '10 year', qty: 9999 });
  let csv = 'variable,value,unit,time';

  data.forEach((x) => {
    csv = `${csv}\n${x.variable},${x.value},${x.unit},${x.time}`;
  });
  const emailService = new TagoServices(context.token).email;
  const from = 'reports@tago.io';
  const subject = 'Tago report';
  const message = `Hi, this is an example of a report.`;
  const attachment = {
    archive: csv,
    filename: 'report.csv',
  };
  await emailService.send(email.value, subject, message, from, attachment);
}

async function explore(context, scope) {
  if (!scope[0]) return context.log('no scope');
  const env_var = TagoUtils.env_to_obj(context.environment);
  if (!env_var.account_token) return context.log('Can\'t find variable account_token on environment variables');
  if (!env_var.device_token) return context.log('Can\'t find variable account_token on environment variables');
  if (!env_var.dashboard_id) return context.log('Can\'t find variable dashboard_id on environment variables');

  const tago_acc = new TagoAccount(env_var.account_token);
  const tago_device = new TagoDevice(env_var.device_token);
  const Notification = new TagoServices(context.token).Notification;

  const customer_email = scope.find(x => x.variable === 'email');
  if (customer_email) {
    const token = await TagoUtils.getTokenByName(tago_acc, customer_email.origin, ['Default', 'Generic', 'Token #1', 'Token #2']);
    const device_data = new TagoDevice(token);
    const validate = validation('validation', device_data);
    validate('Generating report, please wait a moment...', 'success');
    await sendReport(context, scope, tago_acc, tago_device, customer_email);
    validate('Report successfully generated, please check your email.', 'success');
    return;
  }

  const customer = scope[0];
  let title;
  let message;
  const ref_id = customer.user_id;

  if (customer.user_cmd === 'install_application') {
    const share = await tago_acc.explore.shareDashboard(customer.user_id, env_var.dashboard_id).catch(() => {
      title = 'Fail';
      message = '"Generate Report" application had a problem during the installation';
    });

    if (!share) {
      title = 'Fail';
      message = '"Generate Report" application had a problem during the installation';
    } else {
      title = 'Success';
      message = '"Generate Report" application has been installed with success!';
    }

    await Notification.send(title, message, ref_id).then(context.log);

    if (title === 'Fail') {
      const customer_acc = new TagoAccount(customer.user_token.token);
      await customer_acc.explore.uninstallApplication(customer.user_id).then(context.log);
    }
  } else {
    title = 'Success';
    message = '"Generate Report" application has been uninstalled with success!';
    await Notification.send(title, message, ref_id).then(context.log);
  }
}

module.exports = new TagoAnalysis(explore, 'ANALYSIS TOKEN HERE IF YOU WANT TO RUN EXTERNAL');
