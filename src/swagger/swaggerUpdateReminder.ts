export const swaggerUpdateReminder = {
  detail: {
    tags: ["Reminders"],
    summary: "Update an existing reminder",
    description:
      "Updates an existing reminder with new values. Requires an active session.",
    parameters: [
      {
        name: "id",
        in: "path" as const,
        required: true,
        description: "The reminder ID to update",
        schema: { type: "integer" as const, example: 1 },
      },
    ],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          example: {
            title: "Updated Doctor's Appointment",
            date: "2026-02-25T10:00:00Z",
            location: "Downtown Medical Clinic",
            description: "Rescheduled checkup with Dr. Smith",
            reminders: [
              {
                id: "reminder-1",
                mode: "email",
                address: "newemail@example.com",
              },
            ],
            alerts: [{ id: "alert-1", time: 3600000 }],
            is_recurring: false,
            recurrence: null,
            start_date: null,
            end_date: null,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Reminder successfully updated",
        content: {
          "application/json": {
            example: {
              id: 1,
              title: "Updated Doctor's Appointment",
              date: "2026-02-25T10:00:00Z",
              location: "Downtown Medical Clinic",
              description: "Rescheduled checkup with Dr. Smith",
              reminders: [
                {
                  id: "reminder-1",
                  mode: "email",
                  address: "newemail@example.com",
                },
              ],
              alerts: [{ id: "alert-1", time: 3600000 }],
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
      404: {
        description: "Reminder not found",
      },
      500: {
        description: "Server error during reminder update",
      },
    },
  },
};
