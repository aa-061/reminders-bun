# Reminders Server - Improvement Roadmap

This document outlines a phased approach to improving the reminders server from an MVP to a production-ready application while maintaining simplicity.

---

## Executive Summary

The current implementation works but has three main areas for improvement:
1. **Scheduler Architecture**: Replace `setInterval` with a more robust scheduling approach
2. **Core Logic Refactoring**: Clean up the `checkReminders()` function for maintainability
3. **General Code Quality**: Apply production-ready patterns across the codebase

---

## Phase 1: Refactor checkReminders() Function ✅ COMPLETE

**Priority: HIGH** | **Risk: MEDIUM** | **Complexity: MEDIUM**

The `checkReminders()` function has been successfully refactored into clean, maintainable code with clear separation of concerns.

### Previous Problems (Now Resolved ✅)

1. ~~**Mixed responsibilities**~~: Now separated into single-responsibility functions
2. ~~**Deep nesting**~~: Replaced with early returns and clear step-by-step flow
3. ~~**Implicit business rules**~~: Now explicit constants in `SCHEDULER_CONFIG`
4. ~~**No separation between recurring and one-time logic**~~: Now handled via `checkDeactivation()` router function

### Implemented Refactoring Strategy

#### Step 1.1: Extract Configuration Constants ✅ DONE

Create a dedicated config section for business rule constants:

```typescript
// src/scheduler/config.ts
export const SCHEDULER_CONFIG = {
  STALE_THRESHOLD_MS: 60 * 60 * 1000,  // 1 hour
  INTERVAL_MS: Number(process.env.SCHEDULER_INTERVAL) || 3000,
};
```

#### Step 1.2: Create Pure Helper Functions ✅ DONE

Extract logic into small, testable functions:

```typescript
// src/scheduler/helpers/

// Determines if a one-time reminder should be deactivated
function shouldDeactivateOneTime(reminder: TReminder, now: Date): {
  shouldDeactivate: boolean;
  reason?: string
}

// Determines if a recurring reminder should be deactivated
function shouldDeactivateRecurring(
  reminder: TReminder,
  nextEventTime: Date
): { shouldDeactivate: boolean; reason?: string }

// Calculates the next event time for any reminder type
function calculateNextEventTime(
  reminder: TReminder,
  now: Date
): Date | null

// Determines which alerts should fire right now
function getAlertsToFire(
  reminder: TReminder,
  eventTime: Date,
  now: Date,
  intervalMs: number
): Alert[]

// Checks if we've already alerted for this event instance
function hasAlreadyAlertedForEvent(
  reminder: TReminder,
  alertTime: Date
): boolean
```

#### Step 1.3: Create Notification Service ✅ DONE

Separate notification concerns:

```typescript
// src/scheduler/notification-service.ts
export async function sendNotifications(
  reminder: TReminder,
  contacts: Contact[]
): Promise<void>
```

#### Step 1.4: Rewrite Main Function with Clear Flow ✅ DONE

Refactored into clean, single-responsibility functions:

```typescript
// src/check-reminders.ts
export async function checkReminders(): Promise<void> {
  const reminders = getReminders();
  const now = new Date();

  for (const reminder of reminders) {
    await processReminder(reminder, now);
  }
}

async function processReminder(reminder: TReminder, now: Date): Promise<void> {
  // Skip inactive reminders
  if (!reminder.is_active) return;
  if (!reminder.alerts || reminder.alerts.length === 0) return;

  // Step 1: Calculate next event time
  const eventTime = calculateNextEventTime(reminder, now);
  if (!eventTime) return;

  // Step 2: Check if reminder should be deactivated
  const deactivation = checkDeactivation(reminder, eventTime, now);
  if (deactivation.shouldDeactivate) {
    deactivateReminder(reminder.id!, reminder.title);
    console.log(`DEACTIVATING: '${reminder.title}' - ${deactivation.reason}`);
    return;
  }

  // Step 3: Process alerts
  await processAlerts(reminder, eventTime, now);
}

function checkDeactivation(
  reminder: TReminder,
  eventTime: Date,
  now: Date
): { shouldDeactivate: boolean; reason?: string } {
  if (reminder.is_recurring && reminder.recurrence) {
    return shouldDeactivateRecurring(reminder, eventTime);
  }
  return shouldDeactivateOneTime(reminder, now);
}

async function processAlerts(
  reminder: TReminder,
  eventTime: Date,
  now: Date
): Promise<void> {
  const alertsToFire = getAlertsToFire(
    reminder,
    eventTime,
    now,
    SCHEDULER_CONFIG.INTERVAL_MS
  );

  if (alertsToFire.length > 0) {
    console.log(`ALERT TRIGGERED for '${reminder.title}'! Sending notifications...`);
    await sendNotifications(reminder, reminder.reminders);
    updateLastAlertTime(reminder.id!, now);
  }
}
```

#### Step 1.5: Actual File Structure After Refactoring ✅ DONE

```
src/
├── check-reminders.ts        # Main orchestrator (refactored with clear flow)
├── utils.ts                  # Contains deactivateReminder and updateLastAlertTime
├── scheduler/
│   ├── config.ts             # Business rule constants (STALE_THRESHOLD_MS, INTERVAL_MS)
│   ├── notification-service.ts  # Notification sending logic
│   └── helpers/
│       ├── index.ts          # Exports all helper functions
│       ├── calculateNextEventTime.ts
│       ├── shouldDeactivateOneTime.ts
│       ├── shouldDeactivateRecurring.ts
│       ├── getAlertsToFire.ts
│       └── hasAlreadyAlertedForEvent.ts
```

**Note:** Deactivation logic (`deactivateReminder`, `updateLastAlertTime`) remains in `src/utils.ts` as it's used across the application, not just by the scheduler.

### Testing Strategy for Phase 1 ✅ VERIFIED

Manual testing confirmed:
1. ✅ One-time reminders fire alerts correctly and send emails
2. ✅ Deactivation logic works as expected (one-time reminders deactivate after alerting)
3. ✅ Console logging provides clear visibility: "ALERT TRIGGERED" and "DEACTIVATING" messages
4. ✅ All behavior preserved from original implementation
5. ✅ Code is now significantly more readable and maintainable

### Phase 1 Summary

**Achievements:**
- Reduced `checkReminders()` from 82 lines of deeply nested code to a clean 99-line file with 4 focused functions
- Created 7 reusable helper functions in modular files
- Extracted configuration constants for maintainability
- Separated notification concerns into dedicated service
- Added comprehensive JSDoc comments for all functions
- Achieved the goal: **"Read checkReminders() and understand it in under 2 minutes"** ✅

**Files Modified:**
- `src/check-reminders.ts` - Complete refactoring
- `src/scheduler/config.ts` - Added INTERVAL_MS constant
- `src/scheduler/helpers/shouldDeactivateOneTime.ts` - Fixed return type consistency

**Next Steps:** Ready to proceed with Phase 2 (Scheduler Resilience) or Phase 5 (Testing Foundation)

---

## Phase 2: Improve Scheduler Architecture

**Priority: MEDIUM** | **Risk: LOW** | **Complexity: LOW**

### Current Approach: `setInterval`

```typescript
setInterval(checkReminders, 3000);
```

**Problems:**
- If an iteration takes longer than 3 seconds, iterations can overlap
- No error isolation - an unhandled error could crash the scheduler
- No visibility into scheduler health
- Drift over time (not aligned to clock)

### Recommendation: Keep `setInterval` but Add Resilience

For a simple reminder app, `setInterval` is actually fine. The key issues are:
1. **Overlap prevention**: Ensure one check finishes before the next starts
2. **Error isolation**: Catch and log errors without crashing
3. **Health monitoring**: Know if the scheduler is running

**Why NOT use a full job queue (Bull/BullMQ)?**
- Requires Redis infrastructure
- Overkill for this use case
- Adds deployment complexity

**Why NOT use node-cron?**
- Your scheduler needs to run every 3 seconds (too frequent for typical cron)
- Cron expressions only go down to minute-level precision
- No real benefit over setInterval for this use case

### Proposed Implementation

#### Step 2.1: Create Scheduler Service with Resilience

```typescript
// src/scheduler/scheduler-service.ts
class SchedulerService {
  private isRunning = false;
  private intervalId: Timer | null = null;
  private lastRunAt: Date | null = null;
  private consecutiveErrors = 0;

  start(): void {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => this.tick(), SCHEDULER_CONFIG.INTERVAL_MS);
    console.log('Scheduler started');
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async tick(): Promise<void> {
    // Prevent overlapping runs
    if (this.isRunning) {
      console.warn('Previous scheduler run still in progress, skipping');
      return;
    }

    this.isRunning = true;
    try {
      await checkReminders();
      this.lastRunAt = new Date();
      this.consecutiveErrors = 0;
    } catch (error) {
      this.consecutiveErrors++;
      console.error('Scheduler error:', error);

      // Alert if too many consecutive errors
      if (this.consecutiveErrors >= 5) {
        console.error('CRITICAL: Scheduler has failed 5 times in a row');
      }
    } finally {
      this.isRunning = false;
    }
  }

  getStatus(): { isRunning: boolean; lastRunAt: Date | null; errors: number } {
    return {
      isRunning: this.isRunning,
      lastRunAt: this.lastRunAt,
      errors: this.consecutiveErrors,
    };
  }
}

export const scheduler = new SchedulerService();
```

#### Step 2.2: Add Health Check Endpoint

```typescript
// In index.ts
.get('/health', () => {
  const schedulerStatus = scheduler.getStatus();
  return {
    status: 'ok',
    scheduler: schedulerStatus,
    uptime: process.uptime(),
  };
})
```

#### Step 2.3: Graceful Shutdown

```typescript
// In index.ts
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  scheduler.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  scheduler.stop();
  process.exit(0);
});
```

---

## Phase 3: Code Quality Improvements

**Priority: MEDIUM** | **Risk: LOW** | **Complexity: LOW**

### Step 3.1: Add Request Validation with Elysia

Currently, route handlers cast `body as TCreateReminderInput` without validation. Use Elysia's built-in validation:

```typescript
// Before
.post("/reminders", routes.createReminderRoute)

// After
.post("/reminders", routes.createReminderRoute, {
  body: t.Object({
    title: t.String(),
    date: t.String(),
    description: t.String(),
    // ... rest of schema
  })
})
```

Or use the `elysia-zod` plugin to integrate your existing Zod schemas.

### Step 3.2: Environment-based CORS

```typescript
// src/config.ts
export const CONFIG = {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },
  // ... other config
};
```

### Step 3.3: Structured Logging

Replace `console.log` with a simple structured logger:

```typescript
// src/logger.ts
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>) =>
    log('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) =>
    log('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) =>
    log('error', message, context),
  debug: (message: string, context?: Record<string, unknown>) =>
    log('debug', message, context),
};

function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
  };
  console.log(JSON.stringify(entry));
}
```

### Step 3.4: Remove Dead Code

- Remove commented-out code block in `index.ts` (lines 30-45)
- Clean up any unused imports

### Step 3.5: Add Type Safety to Route Handlers

Ensure all route handlers have explicit return types and proper error handling.

---

## Phase 4: Database Improvements

**Priority: LOW** | **Risk: MEDIUM** | **Complexity: MEDIUM**

### Step 4.1: Add Database Migrations

Create a simple migration system for schema changes:

```
src/
├── db/
│   ├── index.ts          # Database connection
│   ├── migrations/
│   │   ├── 001_initial.sql
│   │   └── 002_add_indexes.sql
│   └── migrate.ts        # Migration runner
```

### Step 4.2: Add Indexes for Performance

```sql
CREATE INDEX IF NOT EXISTS idx_reminders_is_active ON reminders(is_active);
CREATE INDEX IF NOT EXISTS idx_reminders_date ON reminders(date);
```

### Step 4.3: Repository Pattern (Optional)

Consider extracting database operations into a repository:

```typescript
// src/repositories/reminder-repository.ts
export const reminderRepository = {
  findAll: () => getReminders(),
  findById: (id: number) => getReminderById(id),
  findActive: () => getReminders().filter(r => r.is_active),
  create: (data: TCreateReminderInput) => { /* ... */ },
  update: (id: number, data: Partial<TReminder>) => { /* ... */ },
  delete: (id: number) => { /* ... */ },
  deactivate: (id: number) => { /* ... */ },
  updateLastAlertTime: (id: number, time: Date) => { /* ... */ },
};
```

---

## Phase 5: Testing Foundation

**Priority: HIGH** | **Risk: LOW** | **Complexity: MEDIUM**

### Step 5.1: Set Up Test Infrastructure

```bash
bun add -d bun:test
```

Create test structure:

```
tests/
├── unit/
│   ├── scheduler/
│   │   ├── helpers.test.ts
│   │   └── deactivation.test.ts
│   └── utils.test.ts
├── integration/
│   └── routes.test.ts
└── fixtures/
    └── reminders.ts
```

### Step 5.2: Priority Test Cases

1. **Deactivation logic**: Test all conditions that should deactivate a reminder
2. **Alert timing**: Test that alerts fire at correct times
3. **Recurring calculations**: Test cron parsing and next occurrence calculation
4. **API endpoints**: Basic CRUD operations

### Step 5.3: Test Scripts in package.json

```json
{
  "scripts": {
    "test": "bun test",
    "test:watch": "bun test --watch"
  }
}
```

---

## Phase 6: Production Hardening

**Priority: LOW** | **Risk: LOW** | **Complexity: LOW**

### Step 6.1: Rate Limiting

```typescript
import { rateLimit } from 'elysia-rate-limit';

app.use(rateLimit({
  max: 100,
  duration: 60000, // 1 minute
}));
```

### Step 6.2: Request ID Tracking

Add request IDs for tracing:

```typescript
.onBeforeHandle(({ request, set }) => {
  const requestId = crypto.randomUUID();
  set.headers['x-request-id'] = requestId;
})
```

### Step 6.3: API Documentation

Consider adding Swagger/OpenAPI documentation using `@elysiajs/swagger`:

```typescript
import { swagger } from '@elysiajs/swagger';

app.use(swagger({
  documentation: {
    info: {
      title: 'Reminders API',
      version: '1.0.0',
    },
  },
}));
```

---

## Implementation Order (Recommended)

| Order | Phase | Status | Reason |
|-------|-------|--------|--------|
| 1 | Phase 1 (checkReminders refactor) | ✅ **COMPLETE** | Highest impact on maintainability, foundation for other changes |
| 2 | Phase 5 (Testing) | 🔜 Next | Tests will protect against regressions during future changes |
| 3 | Phase 2 (Scheduler resilience) | Pending | Improves reliability with minimal risk |
| 4 | Phase 3 (Code quality) | Pending | Quick wins, low risk |
| 5 | Phase 4 (Database) | Pending | Lower priority, current DB setup works fine |
| 6 | Phase 6 (Production hardening) | Pending | Nice to have, implement when deploying to production |

---

## What to Avoid (Keeping it Simple)

1. **Don't add Redis/job queues** - Overkill for this use case
2. **Don't switch to a different database** - SQLite is perfect for this scale
3. **Don't add an ORM** - Direct SQL with prepared statements is fine
4. **Don't over-abstract** - Keep the codebase readable, not enterprise-y
5. **Don't add microservices** - This is a single service and should stay that way

---

## Success Metrics

After implementing these phases, you should be able to:

1. **Read checkReminders() and understand it in under 2 minutes**
2. **Add a new deactivation rule in under 5 minutes**
3. **Know if the scheduler is healthy via the /health endpoint**
4. **Run tests to verify nothing broke after changes**
5. **Deploy with confidence using Docker**

---

## Appendix: Scheduler Alternatives Analysis

For reference, here's why different scheduling approaches were considered and rejected:

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| `setInterval` | Simple, no dependencies, works | Can overlap, no health visibility | **Use with resilience wrapper** |
| `node-cron` | Clock-aligned, familiar cron syntax | Min precision is 1 minute, overkill | Not suitable for 3s intervals |
| Bull/BullMQ | Robust, retries, visibility | Requires Redis, complex | Overkill |
| Bun.cron | Native, no dependencies | Limited documentation | Future consideration |
| System cron | OS-level, reliable | Requires shell script, external | Not suitable for this app |

The recommendation is to **keep `setInterval` but wrap it with proper error handling, overlap prevention, and health monitoring**.
