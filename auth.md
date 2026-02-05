# Authentication Guide

This application uses [Better Auth](https://www.better-auth.com/) for session-based authentication. All `/reminders` routes are protected and require an active session.

## Quick Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/sign-up/email` | POST | Create new account |
| `/api/auth/sign-in/email` | POST | Sign in |
| `/api/auth/sign-out` | POST | Sign out |
| `/api/auth/session` | GET | Get current session |

## Authentication Flow

1. User signs in via `POST /api/auth/sign-in/email`
2. Server returns a `Set-Cookie` header with `better-auth.session_token`
3. Client includes this cookie in subsequent requests
4. Protected routes validate the session before processing

---

## React Application Integration

### Install the Better Auth Client

```bash
npm install better-auth
# or
bun add better-auth
```

### Create Auth Client

```typescript
// src/lib/auth-client.ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: "http://localhost:8080", // Your API server URL
});

export const { signIn, signUp, signOut, useSession } = authClient;
```

### Sign Up

```typescript
import { signUp } from "@/lib/auth-client";

async function handleSignUp(email: string, password: string, name: string) {
  const result = await signUp.email({
    email,
    password,
    name,
  });

  if (result.error) {
    console.error("Sign up failed:", result.error.message);
    return;
  }

  console.log("Signed up:", result.data.user);
}
```

### Sign In

```typescript
import { signIn } from "@/lib/auth-client";

async function handleSignIn(email: string, password: string) {
  const result = await signIn.email({
    email,
    password,
  });

  if (result.error) {
    console.error("Sign in failed:", result.error.message);
    return;
  }

  console.log("Signed in:", result.data.user);
}
```

### Sign Out

```typescript
import { signOut } from "@/lib/auth-client";

async function handleSignOut() {
  await signOut();
  console.log("Signed out");
}
```

### Check Session (React Hook)

```typescript
import { useSession } from "@/lib/auth-client";

function ProfileComponent() {
  const { data: session, isPending } = useSession();

  if (isPending) return <div>Loading...</div>;
  if (!session) return <div>Not authenticated</div>;

  return (
    <div>
      <p>Welcome, {session.user.name}!</p>
      <p>Email: {session.user.email}</p>
    </div>
  );
}
```

### Protected Route Example

```typescript
import { useSession } from "@/lib/auth-client";
import { Navigate } from "react-router-dom";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();

  if (isPending) return <div>Loading...</div>;
  if (!session) return <Navigate to="/login" />;

  return <>{children}</>;
}
```

### Making Authenticated API Calls

The Better Auth client automatically handles cookies. Just ensure `credentials: "include"` is set:

```typescript
// Using fetch
const response = await fetch("http://localhost:8080/reminders", {
  method: "GET",
  credentials: "include", // Important: sends cookies
  headers: {
    "Content-Type": "application/json",
  },
});

// Using axios
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8080",
  withCredentials: true, // Important: sends cookies
});

const reminders = await api.get("/reminders");
```

---

## Postman Integration

### Method 1: Cookie-Based (Recommended)

1. **Sign In Request:**
   - Method: `POST`
   - URL: `http://localhost:8080/api/auth/sign-in/email`
   - Headers: `Content-Type: application/json`
   - Body (raw JSON):
     ```json
     {
       "email": "your-email@example.com",
       "password": "your-password"
     }
     ```

2. **Enable Cookie Storage:**
   - Go to Settings (gear icon) > General
   - Ensure "Automatically follow redirects" is enabled
   - Ensure cookies are enabled for your workspace

3. **Make Authenticated Requests:**
   - Postman automatically stores and sends cookies
   - Just make requests to protected endpoints like `GET /reminders`

### Method 2: Manual Cookie Header

If automatic cookie handling doesn't work:

1. Sign in and copy the `Set-Cookie` header value from the response
2. For subsequent requests, add a header:
   - Key: `Cookie`
   - Value: `better-auth.session_token=<your-token-value>`

### Postman Collection Variables

Set these variables in your collection:

| Variable | Initial Value | Description |
|----------|---------------|-------------|
| `baseUrl` | `http://localhost:8080` | API base URL |
| `userEmail` | `test@example.com` | Test account email |
| `userPassword` | `your-password` | Test account password |

### Pre-request Script for Auto-Login

Add this to your collection's pre-request script to automatically sign in:

```javascript
// Skip if already have a valid session
if (pm.cookies.has("better-auth.session_token")) {
    return;
}

const baseUrl = pm.collectionVariables.get("baseUrl");
const email = pm.collectionVariables.get("userEmail");
const password = pm.collectionVariables.get("userPassword");

pm.sendRequest({
    url: `${baseUrl}/api/auth/sign-in/email`,
    method: "POST",
    header: {
        "Content-Type": "application/json"
    },
    body: {
        mode: "raw",
        raw: JSON.stringify({ email, password })
    }
}, function (err, response) {
    if (err) {
        console.error("Auto-login failed:", err);
    } else {
        console.log("Auto-login successful");
    }
});
```

---

## Swagger UI Integration

### Accessing Swagger

1. Start the server: `bun run index.ts`
2. Open: `http://localhost:8080/swagger`

### Authenticating in Swagger

1. **Sign In First:**
   - Find `POST /api/auth/sign-in/email` in the Auth section
   - Click "Try it out"
   - Enter your credentials:
     ```json
     {
       "email": "your-email@example.com",
       "password": "your-password"
     }
     ```
   - Click "Execute"
   - The session cookie is now set in your browser

2. **Access Protected Endpoints:**
   - After signing in, the browser stores the session cookie
   - All subsequent requests to protected endpoints will work automatically
   - No need to manually configure authorization in Swagger UI

### Note on Cookie Auth in Swagger

The Swagger UI is configured with `cookieAuth` security scheme. Since Swagger runs in the browser, it automatically uses browser cookies. Just sign in once and all protected endpoints become accessible.

---

## Creating the Initial Admin Account

Before deploying, create an admin account using the provided script:

```bash
# Set environment variables
export ADMIN_EMAIL="admin@example.com"
export ADMIN_PASSWORD="secure-password-here"
export ADMIN_NAME="Admin User"

# Run the script
bun run scripts/create-admin.ts
```

Or inline:

```bash
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=secure-password ADMIN_NAME=Admin bun run scripts/create-admin.ts
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed origin for CORS (your frontend URL) |
| `ALLOW_REGISTRATION` | `false` | Set to `true` to allow public sign-ups |
| `BASE_URL` | `http://localhost:8080` | Server base URL (used for auth callbacks) |

### Production Example

```bash
# .env
CORS_ORIGIN=https://your-app.com
ALLOW_REGISTRATION=false
BASE_URL=https://api.your-app.com
```

---

## Deployment Considerations

### 1. Secure Cookie Settings

In production, Better Auth automatically uses secure cookies when running over HTTPS. Ensure your deployment uses HTTPS.

### 2. CORS Configuration

Update `CORS_ORIGIN` to match your production frontend URL:

```bash
CORS_ORIGIN=https://your-frontend-domain.com
```

### 3. Database Persistence

The SQLite database file (`reminders.db`) stores all auth data (users, sessions). Ensure this file is persisted across deployments:

- **Docker**: Mount a volume for the database file
- **Render/Railway**: Use persistent disk storage
- **Vercel/Serverless**: Consider migrating to a cloud database

### 4. Session Security

Sessions are configured with:
- **Expiration**: 30 days
- **Update Age**: Sessions refresh every 24 hours of activity

For higher security requirements, adjust in `src/auth/index.ts`:

```typescript
session: {
  expiresIn: 60 * 60 * 24 * 7,  // 7 days instead of 30
  updateAge: 60 * 60 * 12,      // Refresh every 12 hours
}
```

### 5. Registration Control

Keep `ALLOW_REGISTRATION=false` in production. Create accounts manually using the admin script or implement an invitation system.

### 6. Rate Limiting

Consider adding rate limiting for auth endpoints to prevent brute-force attacks. Better Auth supports rate limiting plugins, or you can add middleware:

```typescript
// Example with elysia-rate-limit (not included by default)
import { rateLimit } from 'elysia-rate-limit';

app.use(rateLimit({
  duration: 60000,  // 1 minute window
  max: 10,          // Max 10 requests per window
  generator: (req) => req.headers.get('x-forwarded-for') || 'anonymous'
}));
```

### 7. Monitoring Failed Logins

Better Auth logs failed login attempts. Monitor these logs in production:

```
[Better Auth]: Invalid password
[Better Auth]: User not found { email: "..." }
```

---

## API Reference

### Sign Up

```
POST /api/auth/sign-up/email
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure-password",
  "name": "User Name"
}
```

**Response (200 OK):**
```json
{
  "user": {
    "id": "abc123",
    "email": "user@example.com",
    "name": "User Name",
    "emailVerified": false,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "session": { ... }
}
```

### Sign In

```
POST /api/auth/sign-in/email
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure-password"
}
```

**Response (200 OK):**
```json
{
  "user": { ... },
  "session": { ... }
}
```

**Response Headers:**
```
Set-Cookie: better-auth.session_token=...; Path=/; HttpOnly; SameSite=Lax
```

### Sign Out

```
POST /api/auth/sign-out
Cookie: better-auth.session_token=...
```

**Response (200 OK):**
```json
{
  "success": true
}
```

### Get Session

```
GET /api/auth/session
Cookie: better-auth.session_token=...
```

**Response (200 OK):**
```json
{
  "session": {
    "id": "session-id",
    "userId": "user-id",
    "expiresAt": "2024-02-01T00:00:00.000Z"
  },
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "User Name"
  }
}
```

---

## Troubleshooting

### "Unauthorized - Please sign in" on Protected Routes

- Ensure the session cookie is being sent with requests
- Check that `credentials: "include"` is set (fetch) or `withCredentials: true` (axios)
- Verify CORS origin matches your frontend URL

### Session Cookie Not Being Set

- Check browser console for CORS errors
- Ensure `CORS_ORIGIN` environment variable matches your frontend URL exactly
- Verify the server is responding with `Set-Cookie` header

### Sign-Up Returns 422 (User Already Exists)

- The email is already registered
- Use sign-in instead, or use a different email

### Sign-Up Returns 403 (Forbidden)

- Registration is disabled (`ALLOW_REGISTRATION=false`)
- Set `ALLOW_REGISTRATION=true` or use the admin script to create accounts
