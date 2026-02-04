export const swaggerActiveReminders = {
  detail: {
    tags: ["Reminders"],
    summary: "Get all active reminders",
    description:
      "Retrieves all currently active reminders (where is_active = true). Requires API key authentication.",
    responses: {
      200: {
        description: "List of active reminders",
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
                  {
                    id: "reminder-2",
                    mode: "push",
                    address: "user-push-token",
                  },
                ],
                alerts: [
                  { id: "alert-1", time: 900000 },
                  { id: "alert-2", time: 3600000 },
                ],
                is_recurring: true,
                recurrence: "0 14 * * MON",
                start_date: "2026-02-03T00:00:00Z",
                end_date: "2026-12-31T23:59:59Z",
                last_alert_time: "2026-02-03T13:50:00Z",
                is_active: true,
              },
              {
                id: 2,
                title: "Project Deadline",
                date: "2026-02-15T17:00:00Z",
                location: null,
                description: "Submit final project deliverables",
                reminders: [
                  {
                    id: "reminder-3",
                    mode: "email",
                    address: "user@example.com",
                  },
                ],
                alerts: [{ id: "alert-3", time: 86400000 }],
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
