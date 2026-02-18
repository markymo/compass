import 'dotenv/config';
import { execSync } from "node:child_process";

function run(cmd) {
    console.log(`\n> ${cmd}`);
    execSync(cmd, { stdio: "inherit" });
}

function mustHave(name) {
    if (!process.env[name]) throw new Error(`Missing env var: ${name}`);
}

const vercelEnv = process.env.VERCEL_ENV; // "preview" | "production" | (undefined locally)
console.log("VERCEL_ENV =", vercelEnv || "(not set)");

// Ensure DATABASE_URL is present
mustHave("DATABASE_URL");

// Always generate Prisma Client for Next build
run("npx prisma generate");

// Run migrations on Preview automatically
if (vercelEnv === "preview") {
    console.log("Running Preview migrations…");
    run("npx prisma migrate deploy");
}

// Production migrations are gated (prevents accidental prod schema changes)
if (vercelEnv === "production") {
    if (process.env.ALLOW_PROD_MIGRATIONS === "true") {
        console.log("Running Production migrations…");
        run("npx prisma migrate deploy");
    } else {
        console.log("Skipping Production migrations (ALLOW_PROD_MIGRATIONS != true).");
    }
}

// Build Next
run("npx next build");
