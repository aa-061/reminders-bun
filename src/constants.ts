// Webhook routes are public — secured by QStash signature verification.
// All /reminders routes are protected by Better Auth session middleware (see index.ts).
export const WEBHOOK_ROUTES = ["/webhooks/reminder-alert", "/webhooks/cleanup"];
