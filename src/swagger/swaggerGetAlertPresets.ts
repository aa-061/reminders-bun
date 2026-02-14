export const swaggerGetAlertPresets = {
  detail: {
    tags: ["Alert Presets"],
    summary: "Get all alert presets",
    description:
      "Retrieves all alert presets for the authenticated user. Requires an active session.",
    responses: {
      200: {
        description: "List of user alert presets",
        content: {
          "application/json": {
            example: [
              {
                id: 1,
                name: "5 minutes before",
                ms: 300000,
                user_id: "user-123",
              },
              {
                id: 2,
                name: "1 hour before",
                ms: 3600000,
                user_id: "user-123",
              },
            ],
          },
        },
      },
      401: {
        description: "Unauthorized - no active session",
      },
    },
  },
};
