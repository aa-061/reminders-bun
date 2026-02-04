import { Elysia } from "elysia";
import { swagger, type ElysiaSwaggerConfig } from "@elysiajs/swagger";
import { checkReminders } from "./src/check-reminders";
import { unprotectedRoutes } from "./src/constants";
import { routes } from "./src/route-handlers";
import { cors } from "@elysiajs/cors";
import { webhookReminderAlertRoute } from "./src/route-handlers/webhook-reminder-alert";
import {
  swaggerActiveReminders,
  swaggerAllReminders,
  swaggerCreateReminder,
  swaggerGetReminderById,
  swaggerMainConfig,
  swaggerUpdateReminder,
  swaggerDeleteReminder,
  swaggerDeleteRemindersBulk,
  swaggerWebhookAlert,
} from "./src/swagger";

const API_KEY = process.env.APP_API_KEY;
const PORT = process.env.APP_PORT;
// Run once on startup — deactivates stale reminders and fires any due alerts
// that QStash missed. On Render free tier this is a cold start on each wake-up,
// so it runs once per cycle without keeping the server alive via setInterval.
checkReminders();

const app = new Elysia()
  .use(swagger(swaggerMainConfig))
  .use(
    cors({
      origin: "http://localhost:3000", // Allow your React app
      allowedHeaders: ["Content-Type", "x-api-key"], // 2. Must include your custom header!
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    }),
  )
  .onError(({ error, set }) => {
    console.error(error);
    set.status = 500;

    const errorMessage = (error as Error).message || "Unknown error occurred.";
    return { error: "Internal Server Error", details: errorMessage };
  })
  // .onBeforeHandle(({ request, set }) => {
  //   const url = new URL(request.url);
  //   const routeIsUnprotected = unprotectedRoutes.some(
  //     (route) =>
  //       route.method === request.method && route.pathname === url.pathname,
  //   );

  //   if (routeIsUnprotected) return;

  //   const apiKey = request.headers.get("x-api-key");

  //   if (apiKey !== API_KEY) {
  //     set.status = 401;
  //     return { error: "Invalid or missing API Key" };
  //   }
  // })
  .onBeforeHandle(({ request, set }) => {
    // 1. ADD THIS LINE: Ignore preflight requests
    if (request.method === "OPTIONS") return;

    const url = new URL(request.url);
    const routeIsUnprotected = unprotectedRoutes.some(
      (route) =>
        route.method === request.method && route.pathname === url.pathname,
    );

    if (routeIsUnprotected) return;

    const apiKey = request.headers.get("x-api-key");

    if (apiKey !== API_KEY) {
      set.status = 401;
      return { error: "Invalid or missing API Key" };
    }
  })
  .get("/reminders", routes.getActiveRemindersRoute, swaggerActiveReminders)
  .get("/reminders/all", routes.getAllRemindersRoute, swaggerAllReminders)
  .get("/reminders/:id", routes.getReminderByIdRoute, swaggerGetReminderById)
  .post("/reminders", routes.createReminderRoute, swaggerCreateReminder)
  .put("/reminders/:id", routes.updateReminderRoute, swaggerUpdateReminder)
  .delete("/reminders/:id", routes.deleteReminderRoute, swaggerDeleteReminder)
  .delete(
    "/reminders/bulk",
    routes.deleteRemindersBulkRoute,
    swaggerDeleteRemindersBulk,
  )
  .post(
    "/webhooks/reminder-alert",
    webhookReminderAlertRoute,
    swaggerWebhookAlert,
  )
  .listen(PORT || 8080);

console.log(`Server is running at ${app.server?.hostname}:${app.server?.port}`);
