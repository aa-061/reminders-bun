export const swaggerAllReminders = {
  detail: {
    tags: ["Reminders"],
    summary: "Get all reminders",
    description:
      "Retrieves all reminders including active and inactive ones. Requires API key authentication.",
    responses: {
      200: {
        description: "List of all reminders",
        content: {
          "application/json": {
            example: [
              {
                id: 1,
                title: "Team Meeting",
                date: "2026-02-10T14:00:00Z",
                location: "Conference Room A",
                description: "Weekly team sync-up meeting",
                reminders: [
                  {
                    id: "reminder-1",
                    mode: "email",
                    address: "user@example.com",
                  },
                ],
                alerts: [{ id: "alert-1", time: 900000 }],
                is_recurring: false,
                recurrence: null,
                start_date: null,
                end_date: null,
                last_alert_time: null,
                is_active: true,
              },
            ],
          },
        },
      },
    },
  },
};
