# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Install dependencies:**
```bash
bun install
```

**Run the server:**
```bash
bun run index.ts
```

**Run with Docker:**
```bash
docker build -t reminders-server .
docker run -p 8080:8080 reminders-server
```

## Testing

**Test Commands (run manually as needed):**

```bash
bun test                                         # Run all tests
bun test --watch                                 # Watch mode (during development)
bun test --coverage                              # With coverage report
bun test tests/integration/reminders.test.ts     # Specific test file
bun run typecheck                                 # TypeScript type-check
```

### Test Organization

```
tests/
├── setup.ts              # Test setup, in-memory database
├── test-utils.ts         # Shared utilities and factories
├── integration/          # API endpoint tests
│   ├── reminders.test.ts # CRUD operations
│   ├── auth.test.ts      # Authentication tests
│   └── webhooks.test.ts  # Webhook handler tests
└── unit/                 # Unit tests
    ├── schemas.test.ts   # Zod validation
    ├── scheduler-helpers.test.ts
    └── repository.test.ts
```

### Testing Guidelines for Claude

1. **Manual testing** - You will not automatically run tests after changes. Run tests yourself before committing.
2. **Type safety** - TypeScript strict mode is enabled. Try to catch type errors during implementation, but you don't need to run typecheck after every change.
3. **Add tests for new functionality** - When adding new features or endpoints, add corresponding tests (optional: can be done separately).
4. **Keep tests passing** - If you notice existing tests fail due to your changes, fix them before committing.

## Architecture Overview

This is a **Bun-first TypeScript server** built with **Elysia.js** for managing reminder notifications. The architecture follows a clean, functional design with modular route handlers.

### Core Components

**Entry Point:** `index.ts`
- Initializes Elysia app with CORS, error handling, and API key authentication
- Starts background scheduler that runs `checkReminders()` every 3 seconds (configurable via `SCHEDULER_INTERVAL` env var)
- Defines REST API routes

**Database:** SQLite via `@libsql/client`
- Local development: `file:reminders.db` (single file, same directory as the project)
- Production (Render): Turso cloud SQLite — set `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`
- Tests: `file::memory:` (fresh in-memory DB per worker, selected when `NODE_ENV=test`)
- Schema bootstrap runs via top-level `await` in `src/db.ts` (CREATE TABLE IF NOT EXISTS)
- All queries are encapsulated in repositories (`src/repositories/`). Never import `client` directly outside of a repository implementation.

**Scheduler:** `src/check-reminders.ts`
- Background process that checks for due reminders
- Handles both one-time and recurring (cron-based) reminders
- Multi-alert support with offset-based triggering
- Auto-deactivates reminders based on rules (missed by >1hr, past end_date, one-time after alert)

**Route Handlers:** `src/route-handlers/`
- Each route in its own file following the pattern: `{action}-{resource}.ts`
- All handlers exported via `src/route-handlers/index.ts`
- Shared logic in `route-helpers.ts` (getReminders, getReminderById)

### Key Architectural Patterns

**Repository Pattern:**
- Every table has its own interface (`src/repositories/*-repository.interface.ts`) and implementation (`src/repositories/sqlite-*-repository.ts`).
- All repository methods are **async** (return `Promise`s) because `@libsql/client` is fully async.
- Concrete implementations are the **only** place that imports `client` from `src/db.ts`. All other code obtains a repository via the factory functions exported from `src/repositories/index.ts` (e.g. `getReminderRepository()`, `getAppSettingsRepository()`).
- Adding a new table means: (1) interface, (2) implementation class, (3) factory in `index.ts`. Nothing else should touch the database directly.

**DTO Transformation Pattern:**
- Database stores arrays/objects as JSON strings, booleans as integers (0/1)
- `route-helpers.ts` transforms database records to proper TypeScript types
- Always use `getReminders()` or `getReminderById()` for data retrieval to ensure proper transformation

**Validation Pattern:**
- Zod schemas in `src/schemas.ts` define all data structures and validation rules
- Two schema types: Regular schemas (with typed arrays/objects) and DTO schemas (JSON strings)
- Use `ReminderSchema` for application logic, `ReminderDTOSchema` for database operations

**Email Flexibility:**
- Supports SendGrid (production) or Mailtrap (development) via `MAIL_SERVICE` env var
- Email handlers in `src/email-handlers.ts`

**Authentication:**
- API key middleware checks `x-api-key` header for all routes
- Unprotected routes configurable in `src/constants.ts` (currently none)
- API Key is configured via `APP_API_KEY` environment variable

**API Documentation (Swagger/OpenAPI):**
- Automatic interactive API documentation generated with `@elysiajs/swagger`
- Available at `http://localhost:8080/swagger` (UI) and `http://localhost:8080/swagger/json` (OpenAPI spec)
- API key testing: You can paste your `APP_API_KEY` into the Swagger UI authorization button (lock icon) to test authenticated endpoints
- Includes detailed examples for all endpoints with realistic sample data
- **IMPORTANT:** When adding new routes or modifying existing endpoints, update the route details in `index.ts` (see swagger configuration section). Swagger must be kept in sync with API changes.

### Data Model

**Reminders Table:**
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
title           TEXT
date            TEXT (ISO format: 2025-11-29T03:03:53Z)
location        TEXT (nullable)
description     TEXT
reminders       TEXT (JSON array: [{id, mode, address}])
alerts          TEXT (JSON array: [{id, time}])
is_recurring    BOOLEAN
recurrence      TEXT (cron expression, nullable)
start_date      TEXT (ISO format, nullable)
end_date        TEXT (ISO format, nullable)
last_alert_time TEXT (ISO format, nullable)
is_active       INTEGER (0 or 1)
```

**Alert System:**
- Alerts are offsets in milliseconds before the reminder date
- Minimum alert time: 3000ms
- Scheduler compares current time against `(reminder_date - alert_offset)`

**Recurring Reminders:**
- Uses cron expressions in `recurrence` field (via `cron-parser` library)
- Scheduler calculates next occurrence after each alert
- Deactivated when current time exceeds `end_date`

### Route Structure

| Method | Route | Handler | Purpose |
|--------|-------|---------|---------|
| GET | /reminders | get-active-reminders.ts | Active reminders only (is_active=1) |
| GET | /reminders/all | get-all-reminders.ts | All reminders |
| GET | /reminders/:id | get-reminder.ts | Single reminder by ID |
| POST | /reminders | create-reminder.ts | Create new reminder |
| PUT | /reminders/:id | update-reminder.ts | Update existing reminder |
| DELETE | /reminders/:id | delete-reminder.ts | Delete single reminder |
| DELETE | /reminders/bulk | delete-reminders-bulk.ts | Bulk delete via query params |

### Environment Variables

Required (production):
- `TURSO_DATABASE_URL` - Turso database URL (e.g. `libsql://…turso.io`)
- `TURSO_AUTH_TOKEN` - Turso auth token
- `DEFAULT_EMAIL` - Default email address for reminders

Optional / development:
- `PORT` - Server port (default: 8080)
- `SCHEDULER_INTERVAL` - Reminder check interval in ms (default: 3000)
- `USE_POLLING` - `true` for local dev polling, `false` for QStash webhooks
- `MAIL_SERVICE` - Email provider: `mailtrap`
- Mailtrap: `MAILTRAP_HOST`, `MAILTRAP_PORT`, `MAILTRAP_USER`, `MAILTRAP_PASS`
- Auth: `CORS_ORIGIN`, `BASE_URL`, `ALLOW_REGISTRATION`
- QStash: `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, `WEBHOOK_BASE_URL`

## Important Implementation Notes

1. **This is Bun, not Node.js** - Use `bun run` commands. The database layer uses `@libsql/client` (works in Bun natively for local `file:` URLs; connects over HTTP/WS for Turso cloud).
2. **No ORM, but use repositories** - Raw SQL lives only inside `src/repositories/sqlite-*.ts`. Every other file reaches the database through a repository factory (`getReminderRepository()`, `getAppSettingsRepository()`, etc.). Never import `client` outside a repository. All repo methods are async — always `await` them.
3. **Always transform DTOs** - Use `getReminders()` or `getReminderById()` to ensure proper type conversion from database
4. **Scheduler is independent** - Background reminder checking runs on its own interval, separate from HTTP requests
5. **Cron syntax for recurrence** - Standard cron expressions (e.g., `0 9 * * 1-5` for weekdays at 9am)
6. **UTC dates everywhere** - All dates stored and processed in UTC ISO format
7. **Type safety first** - TypeScript strict mode enabled, Zod provides runtime validation
8. **Modular handlers** - New routes should follow the pattern: create file in `route-handlers/`, export from `route-handlers/index.ts`, register in `index.ts`
9. **Keep Swagger in sync** - Whenever you add, remove, or modify API endpoints, update the corresponding route definition in `index.ts` (search for `.get`, `.post`, `.put`, `.delete` with the `detail:` property). Swagger documentation must stay current with actual API behavior. See the swagger configuration section at the top of `index.ts` for examples.
10. **Tests are your responsibility** - You won't automatically run tests. Before committing, manually run `bun test` to verify everything works.
11. **Update tests when needed** - If you add new features, consider adding corresponding tests or updating existing ones. However, this can be done separately or deferred to manual testing.

## Swagger/OpenAPI Integration

### Adding or Modifying Routes with Swagger Documentation

All routes in the Reminders API include Swagger documentation. When making changes:

1. **Adding a new route** - Add the route handler with a `detail` object containing:
   - `tags`: Array of tag names (e.g., `["Reminders"]`)
   - `summary`: Brief one-line description
   - `description`: Detailed explanation
   - `parameters`: Path/query parameters (if any)
   - `requestBody`: Body schema with example (if applicable)
   - `responses`: All possible response codes with examples

2. **Example route with full documentation:**
   ```typescript
   .post("/reminders", routes.createReminderRoute, {
     detail: {
       tags: ["Reminders"],
       summary: "Create a new reminder",
       description: "Creates a new reminder with support for alerts.",
       requestBody: { /* ... */ },
       responses: { /* ... */ },
     },
   })
   ```

3. **Testing the API** - Visit `http://localhost:8080/swagger` and:
   - Click the lock icon (top right) to authorize with your API key
   - Paste your `APP_API_KEY` value
   - Try out the endpoints directly from the Swagger UI

# Process Management Rules
- NEVER leave background services or servers running after a task is complete.
- If you start a dev server (e.g., `bun run dev`), ensure it is killed before finishing the task.
- Before starting a new server on a port (e.g., 8080), check if it is already in use using `lsof -i :8080`.
- If a port is blocked, kill the occupying process before proceeding.
- Use `trap 'kill %1' EXIT` in bash scripts to ensure children are cleaned up.

# Reduce Token Usage                                                                    
                                                                                                      
  1. Code Search Strategy (High Impact)                                                               
                                                                                                      
  - Current issue: You might be running broad explorations with the Explore agent                     
  - Optimization: Use Glob + Grep for targeted searches instead of spawning agents                    
  - Example: Instead of "explore where errors are handled", use Grep to search for specific patterns  
  like throw new Error or catch (                                                                     
                                                                                                      
  2. File Reading Discipline (High Impact)                                                            
                                                                                                      
  - Current issue: Reading entire large files when you only need sections                             
  - Optimization: Use the offset and limit parameters in the Read tool                                
  Read file with limit:100 (first 100 lines)                                                          
  Read file with offset:500, limit:50 (lines 500-550)                                                 
                                                                                                      
  3. Parallel Operations (Medium Impact)                                                              
                                                                                                      
  - Make multiple independent Bash/Read/Glob calls in one message                                     
  - Saves round-trip time and reduces overall context                                                 
                                                                                                      
  4. Avoid Verbose Explanations (Low-Medium Impact)                                                   
                                                                                                      
  - Don't ask me to explain code I haven't read yet                                                   
  - Stick to "here's what I'm doing" in concise statements                                            
                                                                                                      
  5. Task-Specific Agents (Medium Impact)                                                             
                                                                                                      
  - Use the Explore agent for complex codebase questions instead of Bash searches                     
  - Only use specialized agents when truly needed                                                     
                                                                                                      
  6. Skip Intermediate Logging (Low Impact)                                                           
                                                                                                      
  - Avoid running git status between every edit                                                       
  - Batch multiple edits, then check status once                                                      
                                                                                                      
  7. Local IDE Diagnostics (Low Impact)                                                               
                                                                                                      
  - Caveat: Not always reliable, but VSCode's Intellisense catches obvious errors                     
  - Use for quick type checking during development (don't rely solely on it though)                   
                                                                                                      
  8. Comments in Code (Low Impact)                                                                    
                                                                                                      
  - Only add comments when logic is truly unclear                                                     
  - Avoid auto-documenting everything ("creates a user" is redundant if method is createUser())       
                                                                                                      
  9. Minimal PR/Commit Context (Low Impact)                                                          
                                                                                                      
  - Skip verbose commit messages unless required                                                      
  - Short, focused commit summaries are sufficient                                                    
                                                                                                      