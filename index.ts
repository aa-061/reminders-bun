import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { cors } from "@elysiajs/cors";
import { checkReminders } from "./src/check-reminders";
import { routes } from "./src/route-handlers";
import { webhookReminderAlertRoute } from "./src/route-handlers/webhook-reminder-alert";
import { webhookCleanupRoute } from "./src/route-handlers/webhook-cleanup";
import { ensureCleanupSchedule } from "./src/qstash/scheduler";
import { auth } from "./src/auth";
import { requireAuth } from "./src/auth/middleware";
import * as s from "./src/swagger";

const PORT = process.env.APP_PORT;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";
const SCHEDULER_INTERVAL = Number(process.env.SCHEDULER_INTERVAL) || 3000;
const USE_POLLING = process.env.USE_POLLING === "true";

if (USE_POLLING || !process.env.QSTASH_TOKEN) {
  // Local dev: poll checkReminders on an interval so alerts fire without QStash.
  setInterval(checkReminders, SCHEDULER_INTERVAL);
  console.log(`Polling scheduler started (interval: ${SCHEDULER_INTERVAL}ms)`);
} else {
  // Production: QStash fires alerts via /webhooks/reminder-alert.
  // Register (or update) the monthly cleanup cron so stale reminders get deactivated.
  ensureCleanupSchedule();
  console.log("QStash scheduler active - daily cleanup scheduled");
}

export const app = new Elysia()
  .use(swagger(s.swaggerMainConfig))
  .use(
    cors({
      origin: CORS_ORIGIN,
      allowedHeaders: ["Content-Type", "Cookie"],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
    }),
  )
  .onError(({ error, set }) => {
    console.error(error);
    set.status = 500;

    const errorMessage = (error as Error).message || "Unknown error occurred.";
    return { error: "Internal Server Error", details: errorMessage };
  })

  // ============ PUBLIC ROUTES ============

  .get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }))

  // Better Auth handles all /api/auth/* routes
  .all("/api/auth/*", ({ request }) => auth.handler(request))

  // QStash webhooks (secured by signature verification, no session auth needed)
  .post(
    "/webhooks/reminder-alert",
    webhookReminderAlertRoute,
    s.swaggerWebhookAlert,
  )
  .post("/webhooks/cleanup", webhookCleanupRoute, s.swaggerWebhookCleanup)

  // ============ PROTECTED ROUTES ============

  .group("/reminders", (app) =>
    app
      .onBeforeHandle(requireAuth)
      .get("/", routes.getActiveRemindersRoute, s.swaggerActiveReminders)
      .get("/all", routes.getAllRemindersRoute, s.swaggerAllReminders)
      .delete("/bulk", routes.deleteRemindersBulkRoute, s.swaggerDeleteRemindersBulk)
      .get("/:id", routes.getReminderByIdRoute, s.swaggerGetReminderById)
      .post("/", routes.createReminderRoute, s.swaggerCreateReminder)
      .put("/:id", routes.updateReminderRoute, s.swaggerUpdateReminder)
      .delete("/:id", routes.deleteReminderRoute, s.swaggerDeleteReminder),
  )

  .listen(PORT || 8080);

console.log(`Server is running at ${app.server?.hostname}:${app.server?.port}`);
