// Minimal email config checker — logs warnings if SMTP env is missing
function checkEmailConfig() {
  const required = ['MAILTRAP_SMTP_HOST', 'MAILTRAP_SMTP_PORT', 'MAILTRAP_SMTP_USER', 'MAILTRAP_SMTP_PASS'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length === 0) {
    console.log('Email config: SMTP env vars present');
    return true;
  }

  console.warn('Email config: missing SMTP env vars:', missing.join(', '));
  console.warn('Tip: For dev, set MAILTRAP_SMTP_HOST, MAILTRAP_SMTP_PORT, MAILTRAP_SMTP_USER, MAILTRAP_SMTP_PASS or configure a real SMTP service.');
  console.warn('Emails will be no-ops (logged) until configured.');
  return false;
}

module.exports = { checkEmailConfig };
