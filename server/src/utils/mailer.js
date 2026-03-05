const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'noreply@inferno-domini.com';

let transporter = null;

if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

async function sendResetEmail(to, resetUrl) {
  if (!transporter) {
    console.log(`[MAIL-DEV] Reset password link for ${to}:\n  ${resetUrl}`);
    return;
  }

  await transporter.sendMail({
    from: `"Inferno Domini" <${SMTP_FROM}>`,
    to,
    subject: 'Inferno Domini — Reset your password',
    html: `
      <div style="background:#0A0A0F;color:#E8DCC8;padding:32px;font-family:sans-serif;">
        <h1 style="color:#C9A84C;">Inferno Domini</h1>
        <p>You requested a password reset. Click the link below (valid for 1 hour):</p>
        <p><a href="${resetUrl}" style="color:#C9A84C;font-size:18px;">Reset my password</a></p>
        <p style="color:#888;font-size:12px;margin-top:24px;">If you did not request this, ignore this email.</p>
      </div>
    `,
  });
}

module.exports = { sendResetEmail };
