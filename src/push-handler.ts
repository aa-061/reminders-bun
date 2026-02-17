import webPush from "web-push";
import { logger } from "./logger";
import { getPushSubscriptionRepository } from "./repositories";
import type { TReminder } from "./schemas";

// Initialize web-push with VAPID keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:noreply@example.com";

if (vapidPublicKey && vapidPrivateKey) {
  webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  logger.info("Web Push configured with VAPID keys");
} else {
  logger.warn("VAPID keys not configured - push notifications disabled");
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    url?: string;
    reminderId?: number;
    [key: string]: any;
  };
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

/**
 * Checks if Web Push is configured
 */
export function isPushConfigured(): boolean {
  return !!(vapidPublicKey && vapidPrivateKey);
}

/**
 * Gets the VAPID public key for client subscription
 */
export function getVapidPublicKey(): string | null {
  return vapidPublicKey || null;
}

/**
 * Sends a push notification to a single subscription
 */
export async function sendPushNotification(
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  },
  payload: PushPayload
): Promise<boolean> {
  if (!isPushConfigured()) {
    logger.warn("Push notifications not configured");
    return false;
  }

  try {
    await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      JSON.stringify(payload),
      {
        TTL: 60 * 60 * 24, // 24 hours
        urgency: "high",
      }
    );

    logger.info("Push notification sent", {
      endpoint: subscription.endpoint.substring(0, 50) + "...",
    });

    return true;
  } catch (error: any) {
    logger.error("Failed to send push notification", {
      error: error.message,
      statusCode: error.statusCode,
    });

    // Handle expired or invalid subscriptions (410 Gone, 404 Not Found)
    if (error.statusCode === 404 || error.statusCode === 410) {
      logger.info("Removing expired push subscription", {
        endpoint: subscription.endpoint.substring(0, 50) + "...",
      });
      const repo = getPushSubscriptionRepository();
      await repo.delete(subscription.endpoint);
    }

    return false;
  }
}

/**
 * Sends push notifications to all subscriptions for a user
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  const repo = getPushSubscriptionRepository();
  const subscriptions = await repo.getByUserId(userId);

  if (subscriptions.length === 0) {
    logger.info("No push subscriptions for user", { userId });
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    const success = await sendPushNotification(
      {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys_p256dh,
          auth: sub.keys_auth,
        },
      },
      payload
    );

    if (success) {
      sent++;
      await repo.updateLastUsed(sub.endpoint);
    } else {
      failed++;
    }
  }

  logger.info("Push batch complete", { userId, sent, failed });
  return { sent, failed };
}

/**
 * Sends a reminder notification via push
 */
export async function sendPushReminder(
  userId: string,
  reminder: TReminder,
  alertName?: string
): Promise<boolean> {
  const eventDate = new Date(reminder.date);
  const formattedDate = eventDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const formattedTime = eventDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const payload: PushPayload = {
    title: reminder.title,
    body: alertName
      ? `${alertName} - ${formattedDate} at ${formattedTime}`
      : `${formattedDate} at ${formattedTime}`,
    icon: "/pwa-192x192.png",
    badge: "/pwa-64x64.png",
    tag: `reminder-${reminder.id}`,
    data: {
      url: `/reminders/${reminder.id}`,
      reminderId: reminder.id,
    },
    actions: [
      {
        action: "view",
        title: "View",
      },
      {
        action: "dismiss",
        title: "Dismiss",
      },
    ],
  };

  const result = await sendPushToUser(userId, payload);
  return result.sent > 0;
}
