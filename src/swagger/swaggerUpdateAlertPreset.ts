export const swaggerUpdateAlertPreset = {
  detail: {
    tags: ["Alert Presets"],
    summary: "Update an alert preset",
    description:
      "Updates an existing alert preset. Only the alert preset owner can update it.",
    parameters: [
      {
        name: "id",
        in: "path",
        required: true,
        description: "Alert preset ID",
        schema: { type: "integer" },
      },
    ],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          example: {
            name: "30 minutes before",
            ms: 1800000,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Alert preset successfully updated",
        content: {
          "application/json": {
            example: {
              id: 1,
              name: "30 minutes before",
              ms: 1800000,
              user_id: "user-123",
            },
          },
        },
      },
      400: {
        description: "Validation failed or invalid ID",
      },
      401: {
        description: "Unauthorized - no active session",
      },
      404: {
        description: "Alert preset not found",
      },
    },
  },
};
