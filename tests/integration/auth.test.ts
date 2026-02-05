import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { app } from "../../index";
import { TEST_USER, getSessionCookie, sessionHeaders } from "../test-utils";

describe("Authentication (Better Auth)", () => {
  let server: ReturnType<typeof app.listen>;
  let baseUrl: string;

  beforeAll(async () => {
    server = app.listen(0);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const address = server.server?.hostname || "localhost";
    const port = server.server?.port || 8080;
    baseUrl = `http://${address}:${port}`;
  });

  afterAll(() => {
    server.stop();
  });

  // --- Sign-up ---

  describe("POST /api/auth/sign-up/email", () => {
    it("should sign up a new user when registration is enabled", async () => {
      const email = `signup-test-${Date.now()}@example.com`;
      const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: "secure-password-123",
          name: "Signup Test",
        }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as { user: { email: string; name: string } };
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(email);
      expect(data.user.name).toBe("Signup Test");
    });

    it("should return error for duplicate email", async () => {
      // First sign-up
      await fetch(`${baseUrl}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "duplicate@example.com",
          password: "secure-password-123",
          name: "First",
        }),
      });

      // Duplicate attempt
      const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "duplicate@example.com",
          password: "secure-password-123",
          name: "Second",
        }),
      });

      expect(response.status).toBe(422);
    });

    it("should reject sign-up with missing fields", async () => {
      const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "no-password@example.com" }),
      });

      expect(response.status).toBe(400);
    });
  });

  // --- Sign-in ---

  describe("POST /api/auth/sign-in/email", () => {
    it("should sign in with valid credentials and return session cookie", async () => {
      // Ensure user exists
      await fetch(`${baseUrl}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(TEST_USER),
      });

      const response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: TEST_USER.email,
          password: TEST_USER.password,
        }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as { user: { email: string; name: string } };
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(TEST_USER.email);

      // Session cookie should be set
      const setCookie = response.headers.get("set-cookie");
      expect(setCookie).toBeTruthy();
    });

    it("should reject sign-in with wrong password", async () => {
      // Ensure user exists
      await fetch(`${baseUrl}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(TEST_USER),
      });

      const response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: TEST_USER.email,
          password: "wrong-password",
        }),
      });

      expect(response.status).toBe(401);
    });

    it("should reject sign-in for non-existent user", async () => {
      const response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "ghost@example.com",
          password: "doesnt-matter",
        }),
      });

      expect(response.status).toBe(401);
    });
  });

  // --- Protected route access ---

  describe("Protected route enforcement", () => {
    it("should return 401 on GET /reminders without session", async () => {
      const response = await fetch(`${baseUrl}/reminders`);
      expect(response.status).toBe(401);
      const data = (await response.json()) as { error: string };
      expect(data.error).toBeDefined();
    });

    it("should return 401 on POST /reminders without session", async () => {
      const response = await fetch(`${baseUrl}/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test",
          date: new Date().toISOString(),
          description: "Test",
        }),
      });
      expect(response.status).toBe(401);
    });

    it("should return 401 on PUT /reminders/:id without session", async () => {
      const response = await fetch(`${baseUrl}/reminders/1`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated" }),
      });
      expect(response.status).toBe(401);
    });

    it("should return 401 on DELETE /reminders/:id without session", async () => {
      const response = await fetch(`${baseUrl}/reminders/1`, {
        method: "DELETE",
      });
      expect(response.status).toBe(401);
    });

    it("should allow GET /reminders with valid session", async () => {
      const cookie = await getSessionCookie(baseUrl);
      const response = await fetch(`${baseUrl}/reminders`, {
        headers: sessionHeaders(cookie),
      });
      expect(response.status).toBe(200);
    });
  });

  // --- Public routes ---

  describe("Public routes", () => {
    it("should allow GET /health without session", async () => {
      const response = await fetch(`${baseUrl}/health`);
      expect(response.status).toBe(200);
      const data = (await response.json()) as { status: string };
      expect(data.status).toBe("ok");
    });

    it("should allow OPTIONS preflight without session", async () => {
      const response = await fetch(`${baseUrl}/reminders`, {
        method: "OPTIONS",
      });
      expect([200, 204]).toContain(response.status);
    });

    it("should allow POST /webhooks/reminder-alert without session", async () => {
      // Webhook with non-existent reminder — returns 200 with "skipped"
      const response = await fetch(`${baseUrl}/webhooks/reminder-alert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminderId: 99999, isRecurring: false }),
      });
      expect(response.status).toBe(200);
    });
  });

  // --- Sign-out ---

  describe("POST /api/auth/sign-out", () => {
    it("should sign out and invalidate the session", async () => {
      const cookie = await getSessionCookie(baseUrl);

      // Confirm session works before sign-out
      const before = await fetch(`${baseUrl}/reminders`, {
        headers: sessionHeaders(cookie),
      });
      expect(before.status).toBe(200);

      // Sign out
      const signOutResponse = await fetch(`${baseUrl}/api/auth/sign-out`, {
        method: "POST",
        headers: sessionHeaders(cookie),
      });
      expect(signOutResponse.status).toBe(200);

      // Session cookie should now be invalid — subsequent request returns 401
      const after = await fetch(`${baseUrl}/reminders`, {
        headers: sessionHeaders(cookie),
      });
      expect(after.status).toBe(401);
    });
  });
});
