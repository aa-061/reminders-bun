import { type Context } from "elysia";
import { auth } from "../auth";
import { getReminderRepository, getModeRepository, getAlertPresetRepository } from "../repositories";
import { parseIcsFile } from "../utils/ics-parser";
import {
  scheduleReminderAlert,
} from "../qstash/scheduler";
import { logger } from "../logger";
import type { TMode } from "../schemas";

// Default alert times in milliseconds
const DEFAULT_ALERTS = [
  { id: "import-alert-15m", time: 15 * 60 * 1000 }, // 15 minutes
  { id: "import-alert-1h", time: 60 * 60 * 1000 }, // 1 hour
  { id: "import-alert-1d", time: 24 * 60 * 60 * 1000 }, // 1 day
];

export const importIcsRoute = async ({ body, request, set }: Context) => {
  // Authenticate user
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    set.status = 401;
    return { error: "Unauthorized" };
  }

  const userId = session.user.id;

  // Handle file upload - body should contain a File object
  const formData = body as { file?: File };

  if (!formData?.file) {
    set.status = 400;
    return { error: "No file provided. Please upload an .ics file." };
  }

  const file = formData.file;

  // Validate file type
  if (!file.name.endsWith(".ics")) {
    set.status = 400;
    return { error: "Invalid file type. Please upload an .ics file." };
  }

  // Read file content
  let icsContent: string;
  try {
    icsContent = await file.text();
  } catch {
    set.status = 400;
    return { error: "Failed to read file content." };
  }

  // Parse ICS file
  let parsedEvent;
  try {
    parsedEvent = parseIcsFile(icsContent);
  } catch (err) {
    set.status = 400;
    return { error: `Failed to parse ICS file: ${(err as Error).message}` };
  }

  // Validate that the event date is in the future
  const eventDate = new Date(parsedEvent.date);
  if (eventDate <= new Date()) {
    set.status = 400;
    return { error: "Event date must be in the future." };
  }

  // Get user's default notification modes
  const modeRepo = getModeRepository();
  const userModes = await modeRepo.findByUserId(userId);

  // Use default mode or first available mode
  let reminderModes: { id: string; mode: TMode; address: string }[] = [];

  const defaultMode = userModes.find((m) => m.isDefault);
  if (defaultMode) {
    reminderModes = [
      {
        id: `import-mode-${defaultMode.id}`,
        mode: defaultMode.mode as TMode,
        address: defaultMode.address,
      },
    ];
  } else if (userModes.length > 0) {
    // Use first available mode if no default
    reminderModes = [
      {
        id: `import-mode-${userModes[0].id}`,
        mode: userModes[0].mode as TMode,
        address: userModes[0].address,
      },
    ];
  }

  // Get user's alert presets or use defaults
  const alertRepo = getAlertPresetRepository();
  const userAlerts = await alertRepo.findByUserId(userId);

  let alerts = DEFAULT_ALERTS;
  if (userAlerts.length > 0) {
    // Use up to 3 user alert presets
    alerts = userAlerts.slice(0, 3).map((a) => ({
      id: `import-alert-${a.id}`,
      time: a.ms,
    }));
  }

  // Create reminder input
  const reminderInput = {
    title: parsedEvent.title,
    date: parsedEvent.date,
    location: parsedEvent.location,
    description: parsedEvent.description,
    reminders: reminderModes,
    alerts,
    is_recurring: false,
    recurrence: null,
    start_date: null,
    end_date: null,
    user_id: userId,
  };

  // Insert reminder into database
  let insertedId: number | undefined;

  try {
    const repo = getReminderRepository();
    const { id } = await repo.create(reminderInput);
    insertedId = id;
  } catch (dbError) {
    logger.error("Database insertion error during ICS import", {
      error: (dbError as Error).message,
    });
    set.status = 500;
    return {
      error: "Failed to create reminder due to database error.",
      details: (dbError as Error).message,
    };
  }

  if (insertedId !== undefined && insertedId > 0) {
    set.status = 201;

    logger.info("Reminder created from ICS import", {
      id: insertedId,
      title: reminderInput.title,
    });

    // Schedule alerts
    if (alerts.length > 0) {
      const reminderDate = new Date(reminderInput.date);

      for (const alert of alerts) {
        const alertTime = new Date(reminderDate.getTime() - alert.time);

        // Only schedule if alert time is in the future
        if (alertTime > new Date()) {
          await scheduleReminderAlert({
            reminderId: insertedId,
            alertTime,
            title: reminderInput.title,
          });
        }
      }
    }

    return {
      id: insertedId,
      ...reminderInput,
      message: "Reminder successfully imported from ICS file",
    };
  } else {
    logger.error("lastInsertRowid returned 0 during ICS import");
    set.status = 201;
    return { id: 0, ...reminderInput };
  }
};
