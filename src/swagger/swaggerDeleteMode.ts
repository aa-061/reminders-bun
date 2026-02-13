export const swaggerDeleteMode = {
  detail: {
    tags: ["Modes"],
    summary: "Delete a notification mode",
    description:
      "Deletes a notification mode. Only the owner can delete their modes.",
    parameters: [
      {
        in: "path",
        name: "id",
        required: true,
        schema: { type: "integer" },
        description: "Mode ID",
      },
    ],
    responses: {
      200: {
        description: "Mode successfully deleted",
        content: {
          "application/json": {
            example: {
              status: "deleted",
              id: 3,
            },
          },
        },
      },
      400: {
        description: "Invalid mode ID",
      },
      401: {
        description: "Unauthorized - no active session",
      },
    },
  },
};
