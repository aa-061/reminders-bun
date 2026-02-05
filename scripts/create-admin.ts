// Must be set before auth module is imported so disableSignUp evaluates to false
process.env.ALLOW_REGISTRATION = "true";

const { auth } = await import("../src/auth/index.ts");

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_NAME = process.env.ADMIN_NAME || "Admin";

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error(
    "Error: ADMIN_EMAIL and ADMIN_PASSWORD environment variables required",
  );
  console.error(
    "Usage: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=secret123 bun run scripts/create-admin.ts",
  );
  process.exit(1);
}

try {
  await auth.api.signUpEmail({
    body: {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      name: ADMIN_NAME,
    },
  });

  console.log("Admin account created successfully!");
  console.log(`  Email: ${ADMIN_EMAIL}`);
  console.log(`  Name: ${ADMIN_NAME}`);
  console.log("\nYou can now sign in at your app's login page.");
} catch (error: any) {
  if (error.message?.includes("already exists")) {
    console.log("Admin account already exists");
  } else {
    console.error("Error creating admin:", error.message || error);
    process.exit(1);
  }
}
