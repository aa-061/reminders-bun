import { type Context } from "elysia";
import type { TCreateReminderInput } from "../schemas";
import {
  scheduleReminderAlert,
  scheduleRecurringReminder,
} from "../qstash/scheduler";
import { getReminderRepository } from "../repositories";

export const createReminderRoute = async ({ body, set }: Context) => {
  const r = body as TCreateReminderInput;

  if (r.is_recurring && (!r.recurrence || !r.start_date)) {
    set.status = 400;
    return {
      error: "Recurring events must have recurrence string and start_date",
    };
  }

  let insertedId: number | undefined;

  try {
    const repo = getReminderRepository();
    const { id } = repo.create(r);
    insertedId = id;
  } catch (dbError) {
    // Catch and log the actual database error
    console.error("Database Insertion Error:", dbError);
    set.status = 500;

    return {
      error: "Failed to create reminder due to database error.",
      details: (dbError as Error).message,
    };
  }

  if (insertedId !== undefined && insertedId > 0) {
    set.status = 201;

    console.log(`Successfully created a new reminder: ${r.title}!`);

    // After successfully inserting the reminder, schedule the alerts:

    // For recurring reminders
    if (r.is_recurring && r.recurrence) {
      await scheduleRecurringReminder(insertedId, r.recurrence);
    }

    // For one-time reminders or first alert of recurring
    if (r.alerts && r.alerts.length > 0) {
      const reminderDate = new Date(r.date);

      for (const alert of r.alerts) {
        const alertTime = new Date(reminderDate.getTime() - alert.time);

        // Only schedule if alert time is in the future
        if (alertTime > new Date()) {
          await scheduleReminderAlert({
            reminderId: insertedId,
            alertTime,
            title: r.title,
          });
        }
      }
    }

    return { id: insertedId, ...r };
  } else {
    // Fallback path: Log the error and return 201 with the reminder data,
    // assigning a temporary ID (0) so the server doesn't crash.
    console.error(
      "Critical Runtime Error: Manual last_insert_rowid() failed. Returning ID 0 as fallback.",
    );
    set.status = 201;
    return { id: 0, ...r };
  }
};
