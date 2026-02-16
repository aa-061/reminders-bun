import sgMail from "@sendgrid/mail";
import nodemailer from "nodemailer";
import { MailtrapTransport } from "mailtrap";
import { logger } from "./logger";
import { generateICSEvent, generateICSFilename } from "./ics-generator";
import type { TReminder } from "./schemas";

// Initialize SendGrid if API key is available
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Mailtrap configuration - Production API
const mailtrapTransport = nodemailer.createTransport(
  MailtrapTransport({
    token: process.env.MAILTRAP_TOKEN || "",
  })
);

export interface EmailAttachment {
  filename: string;
  content: string;
  type: string;
  disposition?: "attachment" | "inline";
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

/**
 * Sends an email using the configured mail service (SendGrid or Mailtrap)
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const { to, subject, html, text, attachments } = options;
  const mailService = process.env.MAIL_SERVICE || "mailtrap";

  logger.info("Sending email", {
    to,
    subject,
    service: mailService,
    hasAttachments: !!attachments?.length,
  });

  try {
    if (mailService === "sendgrid") {
      return await sendWithSendGrid(to, subject, html, text, attachments);
    } else {
      return await sendWithMailtrap(to, subject, html, text, attachments);
    }
  } catch (error) {
    logger.error("Failed to send email", {
      error: error instanceof Error ? error.message : String(error),
      to,
      subject,
    });
    return false;
  }
}

async function sendWithSendGrid(
  to: string,
  subject: string,
  html: string,
  text?: string,
  attachments?: EmailAttachment[],
): Promise<boolean> {
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  if (!fromEmail) {
    logger.error("SENDGRID_FROM_EMAIL not configured");
    return false;
  }

  const msg: sgMail.MailDataRequired = {
    to,
    from: fromEmail,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, ""),
  };

  // Add attachments if present
  if (attachments && attachments.length > 0) {
    msg.attachments = attachments.map((att) => ({
      filename: att.filename,
      content: Buffer.from(att.content).toString("base64"),
      type: att.type,
      disposition: att.disposition || "attachment",
    }));
  }

  await sgMail.send(msg);
  logger.info("Email sent via SendGrid", { to, subject });
  return true;
}

async function sendWithMailtrap(
  to: string,
  subject: string,
  html: string,
  text?: string,
  attachments?: EmailAttachment[],
): Promise<boolean> {
  const fromEmail = process.env.MAILTRAP_FROM_EMAIL || "hello@demomailtrap.com";
  const fromName = process.env.MAILTRAP_FROM_NAME || "Reminders App";

  const mailOptions: nodemailer.SendMailOptions = {
    from: {
      address: fromEmail,
      name: fromName,
    },
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, ""),
  };

  // Add attachments if present
  if (attachments && attachments.length > 0) {
    mailOptions.attachments = attachments.map((att) => ({
      filename: att.filename,
      content: att.content,
      contentType: att.type,
    }));
  }

  logger.info("Sending email via Mailtrap Production API", { to, subject });
  await mailtrapTransport.sendMail(mailOptions);
  logger.info("Email sent via Mailtrap", { to, subject });
  return true;
}

/**
 * Generates an HTML email body for a reminder notification
 */
export function generateReminderEmailHtml(
  reminder: TReminder,
  alertName?: string,
): string {
  const eventDate = new Date(reminder.date);

  // Validate date before formatting
  if (isNaN(eventDate.getTime())) {
    logger.error("Invalid reminder date in email generation", {
      reminderId: reminder.id,
      dateValue: reminder.date,
      dateType: typeof reminder.date,
    });
    throw new Error(
      `Invalid date for reminder ${reminder.id}: ${reminder.date}`,
    );
  }

  const formattedDate = eventDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedTime = eventDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${reminder.title}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          background-color: #ffffff;
          border-radius: 8px;
          padding: 30px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        .header {
          border-bottom: 2px solid #4f46e5;
          padding-bottom: 15px;
          margin-bottom: 20px;
        }
        .header h1 {
          color: #4f46e5;
          margin: 0 0 5px 0;
          font-size: 24px;
        }
        .alert-badge {
          display: inline-block;
          background-color: #fef3c7;
          color: #92400e;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 500;
        }
        .details {
          margin: 20px 0;
        }
        .detail-row {
          display: flex;
          margin-bottom: 12px;
        }
        .detail-label {
          font-weight: 600;
          color: #6b7280;
          width: 100px;
          flex-shrink: 0;
        }
        .detail-value {
          color: #111827;
        }
        .description {
          background-color: #f9fafb;
          padding: 15px;
          border-radius: 6px;
          margin-top: 20px;
          border-left: 4px solid #4f46e5;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          color: #9ca3af;
          font-size: 12px;
        }
        .calendar-note {
          background-color: #ecfdf5;
          border: 1px solid #a7f3d0;
          padding: 12px;
          border-radius: 6px;
          margin-top: 20px;
          font-size: 14px;
          color: #065f46;
        }
        .calendar-note strong {
          color: #047857;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${reminder.title}</h1>
          ${alertName ? `<span class="alert-badge">${alertName}</span>` : ""}
        </div>

        <div class="details">
          <div class="detail-row">
            <span class="detail-label">Date:</span>
            <span class="detail-value">${formattedDate}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Time:</span>
            <span class="detail-value">${formattedTime}</span>
          </div>
          ${
            reminder.location
              ? `
          <div class="detail-row">
            <span class="detail-label">Location:</span>
            <span class="detail-value">${reminder.location}</span>
          </div>
          `
              : ""
          }
          ${
            reminder.is_recurring
              ? `
          <div class="detail-row">
            <span class="detail-label">Recurring:</span>
            <span class="detail-value">Yes</span>
          </div>
          `
              : ""
          }
        </div>

        ${
          reminder.description
            ? `
        <div class="description">
          <p style="margin: 0;">${reminder.description.replace(/\n/g, "<br>")}</p>
        </div>
        `
            : ""
        }

        <div class="calendar-note">
          <strong>Add to Calendar:</strong> An .ics calendar file is attached to this email.
          Click on it to add this reminder to your calendar app (Google Calendar, Apple Calendar, Outlook, etc.)
        </div>

        <div class="footer">
          <p>This reminder was sent by Reminders App</p>
          <p>To manage your reminders, visit your dashboard</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return html;
}

/**
 * Sends a reminder email with an ICS calendar attachment
 */
export async function sendReminderEmail(
  to: string,
  reminder: TReminder,
  alertName?: string,
  alertMs?: number,
): Promise<boolean> {
  logger.info("Preparing to send reminder email", {
    to,
    reminderId: reminder.id,
    reminderDate: reminder.date,
    dateType: typeof reminder.date,
    alertName,
    alertMs,
  });

  // Validate reminder date
  const testDate = new Date(reminder.date);
  if (isNaN(testDate.getTime())) {
    logger.error("Cannot send email - invalid reminder date", {
      reminderId: reminder.id,
      dateValue: reminder.date,
      dateType: typeof reminder.date,
    });
    return false;
  }

  // Generate ICS content
  const icsContent = await generateICSEvent({
    reminder,
    alertName,
    alertMs,
  });

  // Build attachments array
  const attachments: EmailAttachment[] = [];
  if (icsContent) {
    attachments.push({
      filename: generateICSFilename(reminder),
      content: icsContent,
      type: "text/calendar",
      disposition: "attachment",
    });
  }

  // Generate email HTML
  const html = generateReminderEmailHtml(reminder, alertName);

  // Generate plain text version
  const text = `
${reminder.title}
${alertName ? `Alert: ${alertName}` : ""}

Date: ${new Date(reminder.date).toLocaleString()}
${reminder.location ? `Location: ${reminder.location}` : ""}
${reminder.description ? `\n${reminder.description}` : ""}

---
This reminder was sent by Reminders App
  `.trim();

  return sendEmail({
    to,
    subject: `Reminder: ${reminder.title}`,
    html,
    text,
    attachments,
  });
}
