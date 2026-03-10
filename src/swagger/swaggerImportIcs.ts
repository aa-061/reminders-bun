export const swaggerImportIcs = {
  detail: {
    tags: ["Reminders"],
    summary: "Import reminder from ICS file",
    description:
      "Upload an .ics calendar file to create a new reminder. The event data (title, date, location, description) is extracted from the ICS file. The reminder is created with the user's default notification modes and alert presets.",
    requestBody: {
      required: true,
      content: {
        "multipart/form-data": {
          schema: {
            type: "object" as const,
            properties: {
              file: {
                type: "string" as const,
                format: "binary",
                description: "The .ics calendar file to import",
              },
            },
            required: ["file"],
          },
        },
      },
    },
    responses: {
      201: {
        description: "Reminder successfully created from ICS file",
        content: {
          "application/json": {
            example: {
              id: 5,
              title: "New Patient Appointment with Dr. Smith",
              date: "2026-03-19T16:45:00Z",
              location: "123 Medical Center, Suite 202",
              description: "Appointment Time: 1:00 PM EDT\nPhone: 555-123-4567",
              reminders: [
                {
                  id: "import-mode-1",
                  mode: "email",
                  address: "user@example.com",
                },
              ],
              alerts: [
                { id: "import-alert-15m", time: 900000 },
                { id: "import-alert-1h", time: 3600000 },
                { id: "import-alert-1d", time: 86400000 },
              ],
              is_recurring: false,
              recurrence: null,
              start_date: null,
              end_date: null,
              user_id: "user123",
              message: "Reminder successfully imported from ICS file",
            },
          },
        },
      },
      400: {
        description:
          "Invalid request - no file provided, invalid file type, parse error, or past date",
        content: {
          "application/json": {
            examples: {
              noFile: {
                value: { error: "No file provided. Please upload an .ics file." },
              },
              invalidType: {
                value: { error: "Invalid file type. Please upload an .ics file." },
              },
              parseError: {
                value: { error: "Failed to parse ICS file: ICS file missing required SUMMARY (title) field" },
              },
              pastDate: {
                value: { error: "Event date must be in the future." },
              },
            },
          },
        },
      },
      401: {
        description: "Unauthorized - no active session",
        content: {
          "application/json": {
            example: { error: "Unauthorized" },
          },
        },
      },
      500: {
        description: "Server error during reminder creation",
        content: {
          "application/json": {
            example: {
              error: "Failed to create reminder due to database error.",
              details: "Database connection failed",
            },
          },
        },
      },
    },
  },
};
