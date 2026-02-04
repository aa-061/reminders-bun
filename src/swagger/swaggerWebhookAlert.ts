export const swaggerWebhookAlert = {
  detail: {
    tags: ["Webhooks"],
    summary: "Webhook endpoint for reminder alerts",
    description:
      "Receives webhook calls when a reminder alert is triggered. Used internally by the scheduler.",
    responses: {
      200: {
        description: "Webhook processed successfully",
      },
      400: {
        description: "Invalid webhook payload",
      },
    },
  },
};
