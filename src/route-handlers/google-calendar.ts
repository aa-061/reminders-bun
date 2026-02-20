import type { Context } from "elysia";
import {
  isGoogleConfigured,
  isGoogleConnected,
  getAuthUrl,
  exchangeCodeForTokens,
  saveTokens,
  removeTokens,
  createCalendarEvent,
} from "../google-calendar-handler";
import { getReminderRepository } from "../repositories";
import { logger } from "../logger";
import { auth } from "../auth";

/**
 * GET /api/google/status
 * Returns Google Calendar connection status
 */
export async function handleGoogleStatus({ request, set }: Context): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    set.status = 401;
    return Response.json({ error: "Unauthorized" });
  }

  if (!isGoogleConfigured()) {
    return Response.json({
      configured: false,
      connected: false,
      message: "Google Calendar integration not configured",
    });
  }

  const connected = await isGoogleConnected(session.user.id);

  return Response.json({
    configured: true,
    connected,
    message: connected
      ? "Google Calendar connected"
      : "Google Calendar not connected",
  });
}

/**
 * GET /api/google/auth
 * Returns the OAuth authorization URL
 */
export async function handleGoogleAuth({ request, set }: Context): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    set.status = 401;
    return Response.json({ error: "Unauthorized" });
  }

  if (!isGoogleConfigured()) {
    set.status = 503;
    return Response.json({ error: "Google Calendar not configured" });
  }

  const authUrl = getAuthUrl(session.user.id);

  if (!authUrl) {
    set.status = 500;
    return Response.json({ error: "Failed to generate auth URL" });
  }

  return Response.json({ authUrl });
}

/**
 * GET /api/google/callback
 * OAuth callback handler
 */
export async function handleGoogleCallback({ request }: Context): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // Get the client app URL for redirects
  const clientUrl = process.env.CORS_ORIGIN || "http://localhost:3000";

  if (error) {
    logger.warn("Google OAuth error", { error });
    return Response.redirect(`${clientUrl}/settings?google_error=${error}`);
  }

  if (!code || !state) {
    return Response.redirect(`${clientUrl}/settings?google_error=missing_params`);
  }

  // Decode state to get userId
  let userId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64").toString());
    userId = decoded.userId;
  } catch {
    return Response.redirect(`${clientUrl}/settings?google_error=invalid_state`);
  }

  // Exchange code for tokens
  const tokens = await exchangeCodeForTokens(code);

  if (!tokens) {
    return Response.redirect(`${clientUrl}/settings?google_error=token_exchange_failed`);
  }

  // Save tokens
  await saveTokens(userId, tokens);

  logger.info("Google Calendar connected", { userId });

  return Response.redirect(`${clientUrl}/settings?google_success=true`);
}

/**
 * POST /api/google/disconnect
 * Disconnects Google Calendar
 */
export async function handleGoogleDisconnect({ request, set }: Context): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    set.status = 401;
    return Response.json({ error: "Unauthorized" });
  }

  await removeTokens(session.user.id);

  logger.info("Google Calendar disconnected", { userId: session.user.id });

  return Response.json({ success: true });
}

/**
 * POST /api/google/sync/:id
 * Syncs a reminder to Google Calendar
 */
export async function handleGoogleSync({ params, request, set }: Context): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    set.status = 401;
    return Response.json({ error: "Unauthorized" });
  }

  const reminderId = parseInt((params as any).id);
  if (isNaN(reminderId)) {
    set.status = 400;
    return Response.json({ error: "Invalid reminder ID" });
  }

  const reminderRepo = getReminderRepository();
  const reminder = await reminderRepo.findById(reminderId, session.user.id);

  if (!reminder) {
    set.status = 404;
    return Response.json({ error: "Reminder not found" });
  }

  try {
    const result = await createCalendarEvent(session.user.id, reminder);

    if (!result) {
      set.status = 500;
      return Response.json({ error: "Failed to create calendar event" });
    }

    return Response.json({
      success: true,
      eventId: result.eventId,
      htmlLink: result.htmlLink,
    });
  } catch (error: any) {
    logger.error("Failed to sync reminder to Google Calendar", {
      error: error.message,
      reminderId,
      userId: session.user.id,
    });

    // Check if auth error
    if (error.message.includes("authorization expired")) {
      set.status = 401;
      return Response.json({
        error: error.message,
        requiresReauth: true,
      });
    }

    set.status = 500;
    return Response.json({ error: error.message });
  }
}
