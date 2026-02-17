import { type Context } from "elysia";
import type { TCreateReminderInput } from "../schemas";
import {
  scheduleReminderAlert,
  scheduleRecurringReminder,
} from "../qstash/scheduler";
import { getReminderRepository } from "../repositories";
import { auth } from "../auth";
import { logger } from "../logger";

export const createReminderRoute = async ({ body, request, set }: Context) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    set.status = 401;
    return { error: "Unauthorized" };
  }

  const r = body as TCreateReminderInput & { user_id?: string };
  r.user_id = session.user.id;

  if (r.is_recurring && (!r.recurrence || !r.start_date)) {
    set.status = 400;
    return {
      error: "Recurring events must have recurrence string and start_date",
    };
  }

  let insertedId: number | undefined;

  try {
    const repo = getReminderRepository();
    const { id } = await repo.create(r);
    insertedId = id;
  } catch (dbError) {
    logger.error("Database insertion error", { error: (dbError as Error).message });
    set.status = 500;

    return {
      error: "Failed to create reminder due to database error.",
      details: (dbError as Error).message,
    };
  }

  if (insertedId !== undefined && insertedId > 0) {
    set.status = 201;

    logger.info("Reminder created", { id: insertedId, title: r.title });

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
    logger.error("lastInsertRowid returned 0, using fallback ID");
    set.status = 201;
    return { id: 0, ...r };
  }
};
