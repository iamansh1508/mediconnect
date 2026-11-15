const Mailgen = require('mailgen');
const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  const mailGenerator = new Mailgen({
    theme: 'default',
    product: {
      name: process.env.MAIL_PRODUCT_NAME || 'MediConnect',
      link: process.env.MAIL_PRODUCT_LINK || 'https://mediconnect.local',
    },
  });

  const emailTextual = mailGenerator.generatePlaintext(options.mailgenContent);
  const emailHtml = mailGenerator.generate(options.mailgenContent);

  const transporter = nodemailer.createTransport({
    host: process.env.MAILTRAP_SMTP_HOST,
    port: process.env.MAILTRAP_SMTP_PORT,
    auth: {
      user: process.env.MAILTRAP_SMTP_USER,
      pass: process.env.MAILTRAP_SMTP_PASS,
    },
  });

  const mail = {
    from: process.env.MAIL_FROM || 'noreply@mediconnect.local',
    to: options.email,
    subject: options.subject,
    text: emailTextual,
    html: emailHtml,
  };

  try {
    await transporter.sendMail(mail);
  } catch (error) {
    // don't throw — fail silently in dev but log
    console.error('Email service failed. Check MAIL settings.');
    console.error(error);
  }
};

const emailVerificationMailgenContent = (username, verificationUrl) => ({
  body: {
    name: username,
    intro: "Welcome to MediConnect — we're excited to have you on board.",
    action: {
      instructions: 'To verify your email please click the button below',
      button: { color: '#22BC66', text: 'Verify your email', link: verificationUrl },
    },
    outro: "Need help? Reply to this email.",
  },
});

const forgotPasswordMailgenContent = (username, passwordResetUrl) => ({
  body: {
    name: username,
    intro: 'We got a request to reset your password',
    action: {
      instructions: 'To reset your password click the button below',
      button: { color: '#22BC66', text: 'Reset password', link: passwordResetUrl },
    },
    outro: "Need help? Reply to this email.",
  },
});

module.exports = { sendEmail, emailVerificationMailgenContent, forgotPasswordMailgenContent };
