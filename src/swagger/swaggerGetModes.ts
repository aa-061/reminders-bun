export const swaggerGetModes = {
  detail: {
    tags: ["Modes"],
    summary: "Get all notification modes",
    description:
      "Retrieves all notification modes for the authenticated user. Requires an active session.",
    responses: {
      200: {
        description: "List of user notification modes",
        content: {
          "application/json": {
            example: [
              {
                id: 1,
                mode: "email",
                address: "user@example.com",
                isDefault: true,
                user_id: "user-123",
              },
              {
                id: 2,
                mode: "sms",
                address: "+1234567890",
                isDefault: false,
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
