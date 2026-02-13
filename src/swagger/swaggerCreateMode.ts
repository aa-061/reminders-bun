export const swaggerCreateMode = {
  detail: {
    tags: ["Modes"],
    summary: "Create a notification mode",
    description:
      "Creates a new notification mode for the authenticated user. Email addresses and phone numbers are validated. Only one mode can be set as default.",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          example: {
            mode: "email",
            address: "notifications@example.com",
            isDefault: true,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Mode successfully created",
        content: {
          "application/json": {
            example: {
              id: 3,
              mode: "email",
              address: "notifications@example.com",
              isDefault: true,
              user_id: "user-123",
            },
          },
        },
      },
      400: {
        description: "Validation failed - invalid email or phone format",
      },
      401: {
        description: "Unauthorized - no active session",
      },
    },
  },
};
