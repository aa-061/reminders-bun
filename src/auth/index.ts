import { betterAuth } from "better-auth";
import { Kysely } from "kysely";
import { db } from "../db";
import { BunSqliteDialect } from "./bun-sqlite-dialect";
import { getAuthSchemaRepository } from "../repositories";

// Ensure the four auth tables exist before better-auth queries them.
getAuthSchemaRepository().initialize();

const dialect = new BunSqliteDialect({ database: db });
const kysely = new Kysely({ dialect });

export const auth = betterAuth({
  baseURL: process.env.BASE_URL || "http://localhost:8080",
  database: {
    db: kysely,
    type: "sqlite",
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    disableSignUp: process.env.ALLOW_REGISTRATION !== "true",
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
  },
  trustedOrigins: [process.env.CORS_ORIGIN || "http://localhost:3000"],
});

export type Auth = typeof auth;
