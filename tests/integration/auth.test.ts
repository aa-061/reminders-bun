import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { app } from "../../index";

describe("Authentication", () => {
  let server: ReturnType<typeof app.listen>;
  let baseUrl: string;

  beforeAll(async () => {
    server = app.listen(0);
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 100));

    const address = server.hostname || "localhost";
    const port = server.port || 8080;
    baseUrl = `http://${address}:${port}`;
  });

  afterAll(() => {
    server.stop();
  });

  it("should reject requests without API key", async () => {
    const response = await fetch(`${baseUrl}/reminders`);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("should reject requests with invalid API key", async () => {
    const response = await fetch(`${baseUrl}/reminders`, {
      headers: { "x-api-key": "invalid-key" },
    });
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("should accept requests with valid API key", async () => {
    const response = await fetch(`${baseUrl}/reminders`, {
      headers: { "x-api-key": process.env.APP_API_KEY || "test-api-key" },
    });
    expect(response.status).toBe(200);
  });

  it("should reject POST requests without API key", async () => {
    const response = await fetch(`${baseUrl}/reminders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Test",
        date: new Date().toISOString(),
        description: "Test",
        reminders: [],
        alerts: [],
        is_recurring: false,
      }),
    });
    expect(response.status).toBe(401);
  });

  it("should reject PUT requests without API key", async () => {
    const response = await fetch(`${baseUrl}/reminders/1`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Test",
        date: new Date().toISOString(),
        description: "Test",
        reminders: [],
        alerts: [],
        is_recurring: false,
      }),
    });
    expect(response.status).toBe(401);
  });

  it("should reject DELETE requests without API key", async () => {
    const response = await fetch(`${baseUrl}/reminders/1`, {
      method: "DELETE",
    });
    expect(response.status).toBe(401);
  });

  it("should allow OPTIONS preflight requests without API key", async () => {
    const response = await fetch(`${baseUrl}/reminders`, {
      method: "OPTIONS",
    });
    // OPTIONS requests should be allowed (CORS preflight)
    expect([200, 204]).toContain(response.status);
  });
});
