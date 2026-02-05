export const swaggerCreateReminder = {
  detail: {
    tags: ["Reminders"],
    summary: "Create a new reminder",
    description:
      "Creates a new reminder with support for one-time or recurring alerts. Requires an active session.",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          example: {
            title: "Doctor's Appointment",
            date: "2026-02-20T09:30:00Z",
            location: "City Medical Center",
            description: "Annual checkup with Dr. Johnson",
            reminders: [
              {
                id: "reminder-1",
                mode: "email",
                address: "user@example.com",
              },
              {
                id: "reminder-2",
                mode: "sms",
                address: "+1234567890",
              },
            ],
            alerts: [
              { id: "alert-1", time: 86400000 },
              { id: "alert-2", time: 3600000 },
            ],
            is_recurring: false,
            recurrence: null,
            start_date: null,
            end_date: null,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Reminder successfully created",
        content: {
          "application/json": {
            example: {
              id: 5,
              title: "Doctor's Appointment",
              date: "2026-02-20T09:30:00Z",
              location: "City Medical Center",
              description: "Annual checkup with Dr. Johnson",
              reminders: [
                {
                  id: "reminder-1",
                  mode: "email",
                  address: "user@example.com",
                },
                {
                  id: "reminder-2",
                  mode: "sms",
                  address: "+1234567890",
                },
              ],
              alerts: [
                { id: "alert-1", time: 86400000 },
                { id: "alert-2", time: 3600000 },
              ],
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
      400: {
        description:
          "Invalid request - missing required fields or invalid data",
      },
      500: {
        description: "Server error during reminder creation",
      },
    },
  },
};
