export const swaggerDeleteRemindersBulk = {
  detail: {
    tags: ["Reminders"],
    summary: "Bulk delete reminders",
    description:
      "Deletes multiple reminders at once using comma-separated IDs or ID ranges. Requires API key authentication.",
    parameters: [
      {
        name: "ids",
        in: "query" as const,
        required: true,
        description:
          "Comma-separated reminder IDs (e.g., '1,2,3') or ID range (e.g., '10-20')",
        schema: { type: "string" as const, example: "1,2,3" },
      },
    ],
    responses: {
      200: {
        description: "Reminders successfully deleted",
        content: {
          "application/json": {
            example: {
              status: "success",
              deletedCount: 3,
            },
          },
        },
      },
      500: {
        description: "Server error during bulk deletion",
      },
    },
  },
};
