import type { Context } from "elysia";
import { logger } from "../logger";
import { getPushSubscriptionRepository } from "../repositories";
import { getVapidPublicKey, isPushConfigured, sendPushToUser } from "../push-handler";
import { auth } from "../auth";

interface SubscriptionKeys {
  p256dh: string;
  auth: string;
}

interface SubscriptionBody {
  endpoint: string;
  keys: SubscriptionKeys;
}

/**
 * GET /api/push/vapid-public-key
 * Returns the VAPID public key for client subscription
 * PUBLIC - No auth required
 */
export const handleGetVapidKey = async () => {
  const publicKey = getVapidPublicKey();

  if (!publicKey) {
    return {
      configured: false,
      message: "Push notifications not configured",
    };
  }

  return {
    configured: true,
    publicKey,
  };
};

/**
 * POST /api/push/subscribe
 * Saves a push subscription for the authenticated user
 */
export const handlePushSubscribe = async ({ body, request, set }: Context) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    set.status = 401;
    return { error: "Unauthorized" };
  }

  if (!isPushConfigured()) {
    set.status = 503;
    return { error: "Push notifications not configured" };
  }

  const subscriptionBody = body as SubscriptionBody;
  const { endpoint, keys } = subscriptionBody;

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    set.status = 400;
    return { error: "Invalid subscription data" };
  }

  try {
    const repo = getPushSubscriptionRepository();
    const userAgent = request.headers.get("user-agent") || undefined;

    const subscription = await repo.create({
      user_id: session.user.id,
      endpoint,
      keys_p256dh: keys.p256dh,
      keys_auth: keys.auth,
      user_agent: userAgent,
    });

    logger.info("Push subscription saved", {
      userId: session.user.id,
      endpoint: endpoint.substring(0, 50) + "...",
    });

    set.status = 201;
    return {
      success: true,
      subscription: {
        id: subscription.id,
        created_at: subscription.created_at,
      },
    };
  } catch (error) {
    logger.error("Failed to save push subscription", {
      error: error instanceof Error ? error.message : String(error),
      userId: session.user.id,
    });
    set.status = 500;
    return { error: "Failed to save subscription" };
  }
};

/**
 * POST /api/push/unsubscribe
 * Removes a push subscription
 */
export const handlePushUnsubscribe = async ({ body, request, set }: Context) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    set.status = 401;
    return { error: "Unauthorized" };
  }

  const { endpoint } = body as { endpoint: string };

  if (!endpoint) {
    set.status = 400;
    return { error: "Endpoint required" };
  }

  try {
    const repo = getPushSubscriptionRepository();
    const deleted = await repo.delete(endpoint);

    logger.info("Push subscription removed", {
      userId: session.user.id,
      deleted,
    });

    return { success: true, deleted };
  } catch (error) {
    logger.error("Failed to remove push subscription", {
      error: error instanceof Error ? error.message : String(error),
      userId: session.user.id,
    });
    set.status = 500;
    return { error: "Failed to remove subscription" };
  }
};

/**
 * GET /api/push/subscriptions
 * Lists all push subscriptions for the authenticated user
 */
export const handleGetSubscriptions = async ({ request, set }: Context) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    set.status = 401;
    return { error: "Unauthorized" };
  }

  try {
    const repo = getPushSubscriptionRepository();
    const subscriptions = await repo.getByUserId(session.user.id);

    return {
      count: subscriptions.length,
      subscriptions: subscriptions.map((s) => ({
        id: s.id,
        endpoint: s.endpoint.substring(0, 50) + "...",
        created_at: s.created_at,
        last_used_at: s.last_used_at,
        user_agent: s.user_agent,
      })),
    };
  } catch (error) {
    logger.error("Failed to get push subscriptions", {
      error: error instanceof Error ? error.message : String(error),
      userId: session.user.id,
    });
    set.status = 500;
    return { error: "Failed to get subscriptions" };
  }
};

/**
 * POST /api/push/test
 * Sends a test push notification to the authenticated user
 */
export const handleTestPush = async ({ request, set }: Context) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    set.status = 401;
    return { error: "Unauthorized" };
  }

  const result = await sendPushToUser(session.user.id, {
    title: "Test Notification",
    body: "Push notifications are working! 🎉",
    icon: "/pwa-192x192.png",
    data: {
      url: "/reminders",
    },
  });

  return {
    success: result.sent > 0,
    sent: result.sent,
    failed: result.failed,
  };
};
