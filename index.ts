import { Elysia } from "elysia";
import { checkReminders } from "./src/check-reminders";
import { routes, getReminders } from "./src/route-handlers";
import { unprotectedRoutes } from "./src/constants";

const API_KEY = process.env.APP_API_KEY;
const PORT = process.env.APP_PORT;

// Start Scheduler (runs every 3s as per your current setting)
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
    const url = new URL(request.url);
    const routeIsUnprotected = unprotectedRoutes.some(
      (route) =>
        route.method === request.method && route.pathname === url.pathname
    );

    if (routeIsUnprotected) return;

    const apiKey = request.headers.get("x-api-key");
    if (apiKey !== API_KEY) {
      set.status = 401;
      return { error: "Invalid or missing API Key" };
    }
  })
  .get("/reminders", () => getReminders().filter((r) => r.is_active))
  .get("/reminders/all", () => getReminders())
  .get("/reminders/:id", routes.getReminderByIdRoute)
  .post("/reminders", routes.createReminderRoute)
  .put("/reminders/:id", routes.updateReminderRoute)
  .delete("/reminders/:id", routes.deleteReminderRoute)
  .listen(PORT || 8080);

console.log(`Server is running at ${app.server?.hostname}:${app.server?.port}`);
