import type { Context } from "elysia";
import { isSmsConfigured, validateSmsNumber } from "../sms-handler";
import { auth } from "../auth";

/**
 * GET /api/sms/status
 * Returns SMS configuration status
 * PUBLIC - No auth required
 */
export async function handleSmsStatus(): Promise<Response> {
  return Response.json({
    configured: isSmsConfigured(),
    message: isSmsConfigured()
      ? "SMS notifications are available"
      : "SMS notifications not configured (Twilio credentials missing)",
  });
}

/**
 * POST /api/sms/validate
 * Validates a phone number format
 * PROTECTED - Requires auth
 */
export async function handleSmsValidate({ body, request, set }: Context): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    set.status = 401;
    return Response.json({ error: "Unauthorized" });
  }

  let parsedBody: { phone: string };

  try {
    parsedBody = body as { phone: string };
  } catch {
    set.status = 400;
    return Response.json({ error: "Invalid JSON body" });
  }

  const { phone } = parsedBody;

  if (!phone) {
    set.status = 400;
    return Response.json({ error: "Phone number required" });
  }

  const result = await validateSmsNumber(phone);
  return Response.json(result);
}
