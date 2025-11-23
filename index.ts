import { Elysia, t } from "elysia";
import { Database } from "bun:sqlite";
import sgMail from "@sendgrid/mail";
import cron_parse from "cron-parser";
import * as nodemailer from "nodemailer";
import type { Contact, Reminder } from "./types"; // Updated import

const API_KEY = process.env.APP_API_KEY;
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

const db = new Database("reminders.db");

db.run(`
  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    date TEXT,
    location TEXT,
    description TEXT,
    reminders TEXT,
    alerts TEXT,
    is_recurring BOOLEAN,
    recurrence TEXT,
    start_date TEXT,
    end_date TEXT,
    last_alert_time TEXT,
    is_active INTEGER DEFAULT 1
  )
`);

try {
  db.run("ALTER TABLE reminders ADD COLUMN last_alert_time TEXT");
  console.log("Migration: Added column 'last_alert_time'.");
} catch (e) {}

try {
  db.run("ALTER TABLE reminders ADD COLUMN is_active INTEGER DEFAULT 1");
  console.log("Migration: Added column 'is_active'.");
} catch (e) {}

const updateLastAlertTime = (id: number, time: Date) => {
  db.run("UPDATE reminders SET last_alert_time = ? WHERE id = ?", [
    time.toISOString(),
    id,
  ]);
};

const getReminders = () => {
  const query = db.query("SELECT * FROM reminders");
  const results = query.all() as any[];

  return results.map((r) => ({
    ...r,
    location: r.location ? JSON.parse(r.location) : null,
    reminders: r.reminders ? JSON.parse(r.reminders) : [],
    alerts: r.alerts ? JSON.parse(r.alerts) : [],
    is_recurring: !!r.is_recurring,
    last_alert_time: r.last_alert_time ? new Date(r.last_alert_time) : null,
    is_active: !!r.is_active, // Parse 0/1 to boolean
  }));
};

const getReminderById = (id: number) => {
  const reminder = db
    .query("SELECT * FROM reminders WHERE id = $id")
    .get({ $id: id }) as any;
  if (!reminder) return null;
  return {
    ...reminder,
    location: reminder.location ? JSON.parse(reminder.location) : null,
    reminders: reminder.reminders ? JSON.parse(reminder.reminders) : [],
    alerts: reminder.alerts ? JSON.parse(reminder.alerts) : [],
    is_recurring: !!reminder.is_recurring,
    last_alert_time: reminder.last_alert_time
      ? new Date(reminder.last_alert_time)
      : null,
    is_active: !!reminder.is_active, // Parse 0/1 to boolean
  };
};

const checkReminders = async () => {
  const reminders = getReminders();
  const now = new Date();

  for (const r of reminders) {
    // Only process reminders that are active
    if (!r.is_active) continue;

    if (!r.alerts || r.alerts.length === 0) continue;

    let eventTime: Date;

    if (r.is_recurring && r.recurrence) {
      // Calculate next occurrence time for recurring events
      try {
        const interval = cron_parse.parse(r.recurrence, { currentDate: now });
        eventTime = interval.next().toDate();
      } catch (err) {
        console.error(`Error parsing cron for ${r.title}`, err);
        continue;
      }
    } else {
      // Use the fixed date for one-time events
      eventTime = new Date(r.date);
      // If a one-time event has already alerted, skip it entirely.
      if (r.last_alert_time) continue;
    }

    // Now, calculate the alert time based on the event time and offsets
    for (const offsetMs of r.alerts) {
      const alertDuration = offsetMs;
      const alertTime = new Date(eventTime.getTime() - alertDuration);

      const diff = now.getTime() - alertTime.getTime();

      // Check if the alert was triggered in the last cycle (0s <= diff < 60s)
      if (diff >= 0 && diff < 60000) {
        // Final check: If recurring, make sure we haven't alerted for this specific event time yet.
        if (
          r.is_recurring &&
          r.last_alert_time &&
          r.last_alert_time.getTime() >= alertTime.getTime()
        ) {
          // Already alerted for this recurrence instance
          continue;
        }

        console.log(
          `ALERT TRIGGERED for '${r.title}'! Sending notifications...`
        );

        for (const contact of r.reminders) {
          if (contact.mode === "email") {
            // Use the unified sendEmail function
            await sendEmail(contact.address, r.title, r.description);
          }
        }

        // Acknowledge the alert by setting the last_alert_time to NOW
        updateLastAlertTime(r.id, now);
        // Break out of the alerts loop to prevent multiple alerts for the same event in one run
        break;
      }
    }
  }
};

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

const sendEmail = async (to: string, subject: string, content: string) => {
  if (MAIL_SERVICE === "mailtrap") {
    return mailtrapEmail(to, subject, content);
  }

  return sendgridEmail(to, subject, content);
};

// Start Scheduler (runs every 60s)
// setInterval(checkReminders, 60000);
setInterval(checkReminders, 3000);
console.log("Scheduler started.");

const app = new Elysia()
  .onError(({ code, error, set }) => {
    console.error(error);
    set.status = 500;

    const errorMessage = (error as Error).message || "Unknown error occurred.";
    return { error: "Internal Server Error", details: errorMessage };
  })
  .onBeforeHandle(({ request, set }) => {
    // const url = new URL(request.url);
    // if (request.method === "GET" && url.pathname === "/reminders") return; // Public endpoint

    const apiKey = request.headers.get("x-api-key");
    if (apiKey !== API_KEY) {
      set.status = 401;
      return { error: "Invalid or missing API Key" };
    }
  })
  .get("/reminders", () => getReminders())
  .get("/reminders/:id", ({ params: { id }, set }) => {
    const r = getReminderById(Number(id));
    if (!r) {
      set.status = 404;
      return { error: "Reminder not found" };
    }
    return r;
  })
  .post("/reminders", ({ body, set }) => {
    const r = body as Reminder;

    if (r.is_recurring && (!r.recurrence || !r.start_date)) {
      set.status = 400;
      return {
        error: "Recurring events must have recurrence string and start_date",
      };
    }

    const stmt = db.prepare(`
      INSERT INTO reminders (title, date, location, description, reminders, alerts, is_recurring, recurrence, start_date, end_date, last_alert_time, is_active)
      VALUES ($title, $date, $location, $description, $reminders, $alerts, $is_recurring, $recurrence, $start_date, $end_date, NULL, $is_active)
    `);

    // Prepare bindings defensively
    const bindings = {
      $title: r.title,
      $date: r.date,
      // Ensure null is used if location is undefined or null in the body
      $location: r.location ? JSON.stringify(r.location) : null,
      $description: r.description,
      // Ensure an empty array is stringified if reminders/alerts are missing
      $reminders: JSON.stringify(r.reminders ?? []),
      $alerts: JSON.stringify(r.alerts ?? []),
      $is_recurring: r.is_recurring ? 1 : 0,
      $recurrence: r.recurrence ?? null,
      $start_date: r.start_date ?? null,
      $end_date: r.end_date ?? null,
      // Default is_active to true (1) if not provided in the request body
      $is_active: r.is_active === false ? 0 : 1,
    };

    let insertedId: number | undefined;

    try {
      // Execute with defensive bindings (we ignore the result object here)
      stmt.run(bindings as any);

      // Manually query the last inserted ID using the dedicated function
      const idResult = db.query("SELECT last_insert_rowid() as id").get() as {
        id: number;
      };
      insertedId = idResult?.id;
    } catch (dbError) {
      // Catch and log the actual database error
      console.error("Database Insertion Error:", dbError);
      set.status = 500;
      return {
        error: "Failed to create reminder due to database error.",
        details: (dbError as Error).message,
      };
    }

    // Rely on the manually queried ID
    if (insertedId !== undefined && insertedId > 0) {
      set.status = 201;
      // Success path - return the full object with the determined ID
      return { id: insertedId, ...r };
    } else {
      // Fallback path: Log the error and return 201 with the reminder data,
      // assigning a temporary ID (0) so the server doesn't crash.
      console.error(
        "Critical Runtime Error: Manual last_insert_rowid() failed. Returning ID 0 as fallback."
      );
      set.status = 201; // Maintain 201 status as insertion is presumed successful
      return { id: 0, ...r };
    }
  })
  .put("/reminders/:id", ({ params: { id }, body, set }) => {
    const r = body as Reminder;
    const existing = getReminderById(Number(id));

    if (!existing) {
      set.status = 404;
      return { error: "Reminder not found" };
    }

    const stmt = db.prepare(`
      UPDATE reminders SET 
        title = $title, date = $date, location = $location, description = $description, 
        reminders = $reminders, alerts = $alerts, is_recurring = $is_recurring, 
        recurrence = $recurrence, start_date = $start_date, end_date = $end_date,
        is_active = $is_active -- ADDED
      WHERE id = $id
    `);

    const bindings = {
      $id: Number(id),
      $title: r.title,
      $date: r.date,
      $location: r.location ? JSON.stringify(r.location) : null,
      $description: r.description,
      $reminders: JSON.stringify(r.reminders ?? []),
      $alerts: JSON.stringify(r.alerts ?? []),
      $is_recurring: r.is_recurring ? 1 : 0,
      $recurrence: r.recurrence ?? null,
      $start_date: r.start_date ?? null,
      $end_date: r.end_date ?? null,
      $is_active: r.is_active === false ? 0 : 1, // Ensure update respects explicit deactivation
    };

    try {
      // Execute with defensive bindings
      stmt.run(bindings as any);
    } catch (dbError) {
      console.error("Database Update Error:", dbError);
      set.status = 500;
      return {
        error: "Failed to update reminder due to database error.",
        details: (dbError as Error).message,
      };
    }

    return { id, ...r };
  })
  .delete("/reminders/:id", ({ params: { id } }) => {
    db.run("DELETE FROM reminders WHERE id = ?", [id]);
    return { message: "Deleted" };
  })
  .listen(8080);

console.log(`Server is running at ${app.server?.hostname}:${app.server?.port}`);
