export const swaggerUpdateMode = {
  detail: {
    tags: ["Modes"],
    summary: "Update a notification mode",
    description:
      "Updates an existing notification mode. All fields are optional. Setting isDefault to true will clear the default flag from other modes.",
    parameters: [
      {
        in: "path",
        name: "id",
        required: true,
        schema: { type: "integer" },
        description: "Mode ID",
      },
    ],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          example: {
            address: "newemail@example.com",
            isDefault: true,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Mode successfully updated",
        content: {
          "application/json": {
            example: {
              id: 3,
              mode: "email",
              address: "newemail@example.com",
              isDefault: true,
              user_id: "user-123",
            },
          },
        },
      },
      400: {
        description: "Invalid mode ID or validation failed",
      },
      401: {
        description: "Unauthorized - no active session",
      },
      404: {
        description: "Mode not found or unauthorized",
      },
    },
  },
};
