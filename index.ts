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
import { logger } from "./src/logger";

const PORT = process.env.PORT;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";
const SCHEDULER_INTERVAL = Number(process.env.SCHEDULER_INTERVAL) || 3000;
const USE_POLLING = process.env.USE_POLLING === "true";

if (USE_POLLING || !process.env.QSTASH_TOKEN) {
  // Local dev: poll checkReminders on an interval so alerts fire without QStash.
  setInterval(checkReminders, SCHEDULER_INTERVAL);
  logger.info("Polling scheduler started", { intervalMs: SCHEDULER_INTERVAL });
} else {
  // Production: QStash fires alerts via /webhooks/reminder-alert.
  // Register (or update) the monthly cleanup cron so stale reminders get deactivated.
  ensureCleanupSchedule();
  logger.info("QStash scheduler active - daily cleanup scheduled");
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
  .onError(({ error, set, code, request }) => {
    // Handle NOT_FOUND errors with 404 status instead of 500
    if (code === "NOT_FOUND") {
      // Log 404s at debug level (not error) to avoid cluttering logs
      // Common with health checks, favicon requests, etc.
      logger.debug("Route not found", {
        path: new URL(request.url).pathname,
        method: request.method
      });
      set.status = 404;
      return { error: "Not Found", message: "The requested resource was not found" };
    }

    // Log actual server errors
    logger.error("Unhandled error", {
      message: (error as Error).message,
      stack: (error as Error).stack,
      path: new URL(request.url).pathname
    });
    set.status = 500;

    const errorMessage = (error as Error).message || "Unknown error occurred.";
    return { error: "Internal Server Error", details: errorMessage };
  })

  // ============ PUBLIC ROUTES ============

  // Root route - API info
  .get("/", () => ({
    name: "Reminders API",
    version: "1.0.0",
    status: "ok",
    endpoints: {
      health: "/health",
      auth: "/api/auth/*",
      reminders: "/reminders",
      docs: "/swagger"
    },
    message: "Use /swagger for API documentation"
  }))

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

logger.info(`Server is running at ${app.server?.hostname}:${app.server?.port}`);
