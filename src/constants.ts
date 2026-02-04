import type { IUnprotectedRoute } from "./types";

export const unprotectedRoutes: IUnprotectedRoute[] = [
  // Webhook routes are protected by QStash signature verification, not API key
  {
    method: "POST",
    pathname: "/webhooks/reminder-alert",
  },
  {
    method: "POST",
    pathname: "/webhooks/cleanup",
  },
];
