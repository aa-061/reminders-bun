import sgMail from "@sendgrid/mail";
import * as nodemailer from "nodemailer";

const MAIL_SERVICE =
  (process.env.MAIL_SERVICE as "sendgrid" | "mailtrap") || "sendgrid";

// SendGrid Config
const SENDGRID_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM = process.env.SENDGRID_FROM_EMAIL;

// Mailtrap (SMTP) Config
const MAILTRAP_HOST = process.env.MAILTRAP_HOST;
const MAILTRAP_PORT = process.env.MAILTRAP_PORT;
const MAILTRAP_USER = process.env.MAILTRAP_USER;
const MAILTRAP_PASS = process.env.MAILTRAP_PASS;

if (SENDGRID_KEY && MAIL_SERVICE === "sendgrid") sgMail.setApiKey(SENDGRID_KEY);

const mailtrapTransporter = nodemailer.createTransport({
  host: MAILTRAP_HOST,
  port: MAILTRAP_PORT ? parseInt(MAILTRAP_PORT) : 2525,
  auth: {
    user: MAILTRAP_USER,
    pass: MAILTRAP_PASS,
  },
});

const mailtrapEmail = async (to: string, subject: string, content: string) => {
  if (!MAILTRAP_HOST || !MAILTRAP_USER || !MAILTRAP_PASS) {
    console.log("Skipping Mailtrap email (SMTP config missing).");
    return;
  }

  const text = content || "You have a new reminder!";
  const html = `<p>${text}</p>`;

  try {
    const info = await mailtrapTransporter.sendMail({
      from: SENDGRID_FROM || "no-reply@reminder-app.com",
      to,
      subject,
      text,
      html,
    });
    console.log(`Mailtrap email sent: ${info.messageId}`);
  } catch (error: any) {
    console.error("Mailtrap Error:", error.message);
  }
};

const sendgridEmail = async (to: string, subject: string, content: string) => {
  if (!SENDGRID_KEY || !SENDGRID_FROM) {
    console.log("Skipping SendGrid email (SendGrid keys missing).");
    return;
  }

  const text = content || "You have a new reminder!";
  const html = `<p>${text}</p>`;

  try {
    await sgMail.send({
      to,
      from: SENDGRID_FROM,
      subject,
      text,
      html,
    });
    console.log(`SendGrid email sent to ${to}`);
  } catch (error: any) {
    console.error("SendGrid Error:", error.response?.body || error.message);
  }
};

export const sendEmail = async (
  to: string,
  subject: string,
  content: string
) => {
  if (MAIL_SERVICE === "mailtrap") {
    return mailtrapEmail(to, subject, content);
  }

  return sendgridEmail(to, subject, content);
};
