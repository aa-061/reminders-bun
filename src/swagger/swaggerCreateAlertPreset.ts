export const swaggerCreateAlertPreset = {
  detail: {
    tags: ["Alert Presets"],
    summary: "Create an alert preset",
    description:
      "Creates a new alert preset for the authenticated user. Alert time must be at least 3000 milliseconds.",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          example: {
            name: "15 minutes before",
            ms: 900000,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Alert preset successfully created",
        content: {
          "application/json": {
            example: {
              id: 3,
              name: "15 minutes before",
              ms: 900000,
              user_id: "user-123",
            },
          },
        },
      },
      400: {
        description: "Validation failed - ms must be at least 3000",
      },
      401: {
        description: "Unauthorized - no active session",
      },
    },
  },
};
