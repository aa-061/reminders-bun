export const swaggerDeleteReminder = {
  detail: {
    tags: ["Reminders"],
    summary: "Delete a single reminder",
    description:
      "Deletes a specific reminder by its ID. Requires an active session.",
    parameters: [
      {
        name: "id",
        in: "path" as const,
        required: true,
        description: "The reminder ID to delete",
        schema: { type: "integer" as const, example: 1 },
      },
    ],
    responses: {
      200: {
        description: "Reminder successfully deleted",
        content: {
          "application/json": {
            example: {
              status: "success",
              deletedReminder: {
                id: 1,
                title: "Buy Groceries",
                date: "2026-02-05T10:00:00Z",
                location: "Local Supermarket",
                description: "Buy milk, eggs, bread, and coffee",
                reminders: [
                  {
                    id: "reminder-1",
                    mode: "email",
                    address: "user@example.com",
                  },
                ],
                alerts: [{ id: "alert-1", time: 1800000 }],
                is_recurring: false,
                recurrence: null,
                start_date: null,
                end_date: null,
                last_alert_time: null,
                is_active: true,
              },
            },
          },
        },
      },
      500: {
        description: "Server error during reminder deletion",
      },
    },
  },
};
