import { swagger, type ElysiaSwaggerConfig } from "@elysiajs/swagger";

export const swaggerMainConfig: ElysiaSwaggerConfig = {
  documentation: {
    info: {
      title: "Reminders API",
      version: "2.0.0",
      description:
        "A comprehensive REST API for managing reminders with support for one-time and recurring alerts via email, SMS, push notifications, and iCalendar. Authentication is session-based via Better Auth — sign in first at POST /api/auth/sign-in/email, then all subsequent requests include your session cookie automatically.",
    },
    tags: [
      {
        name: "Auth",
        description:
          "Authentication endpoints (sign in, sign up, sign out, session). Managed by Better Auth.",
      },
      {
        name: "Reminders",
        description: "Manage reminder operations (requires active session)",
      },
      {
        name: "Modes",
        description: "Manage notification modes (email, SMS, call) (requires active session)",
      },
      {
        name: "Webhooks",
        description: "Webhook endpoints for reminder alerts (QStash signature-verified)",
      },
    ],
    servers: [
      {
        url: "http://localhost:8080",
        description: "Local development server",
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "better-auth.session_token",
          description:
            "Session cookie set automatically after signing in via POST /api/auth/sign-in/email. No manual configuration needed — just sign in first.",
        },
      },
    },
    security: [
      {
        cookieAuth: [],
      },
    ],
  },
};

export * from "./swaggerActiveReminders";
export * from "./swaggerAllReminders";
export * from "./swaggerGetReminderById";
export * from "./swaggerCreateReminder";
export * from "./swaggerUpdateReminder";
export * from "./swaggerDeleteReminder";
export * from "./swaggerDeleteRemindersBulk";
export * from "./swaggerGetModes";
export * from "./swaggerCreateMode";
export * from "./swaggerUpdateMode";
export * from "./swaggerDeleteMode";
export * from "./swaggerWebhookAlert";
export * from "./swaggerWebhookCleanup";
