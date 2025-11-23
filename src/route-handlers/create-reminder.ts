import { type Context } from "elysia";
import type { Reminder } from "../types";
import { db } from "../db";

export const createReminderRoute = ({ body, set }: Context) => {
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
};
