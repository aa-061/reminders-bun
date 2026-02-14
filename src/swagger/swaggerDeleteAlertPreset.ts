export const swaggerDeleteAlertPreset = {
  detail: {
    tags: ["Alert Presets"],
    summary: "Delete an alert preset",
    description:
      "Deletes an alert preset. Only the alert preset owner can delete it.",
    parameters: [
      {
        name: "id",
        in: "path",
        required: true,
        description: "Alert preset ID",
        schema: { type: "integer" },
      },
    ],
    responses: {
      200: {
        description: "Alert preset successfully deleted",
        content: {
          "application/json": {
            example: {
              status: "success",
              message: "Alert preset deleted",
            },
          },
        },
      },
      400: {
        description: "Invalid ID",
      },
      401: {
        description: "Unauthorized - no active session",
      },
    },
  },
};
