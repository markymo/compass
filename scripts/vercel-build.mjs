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

// Run schema sync on Preview automatically
if (vercelEnv === "preview") {
    console.log("Running Preview schema sync (db push)…");
    run("npx prisma db push");

    // Seed automatically for 'dev' branch or if forced
    if (process.env.VERCEL_GIT_COMMIT_REF === "dev" || process.env.SEED_PREVIEW === "true") {
        console.log("Running Preview Seed (Auto-detected 'dev' branch)...");
        run("npm run db:seed:dev");
    }
}

// Production schema sync is gated (prevents accidental prod schema changes)
if (vercelEnv === "production") {
    if (process.env.ALLOW_PROD_MIGRATIONS === "true") {
        // Use db push (not migrate deploy) — the DB was bootstrapped with db push
        // and has no Prisma migration history. All schema changes are additive.
        console.log("Running Production schema sync (db push)...");
        run("npx prisma db push");
    } else {
        console.log("Skipping Production schema sync (ALLOW_PROD_MIGRATIONS != true).");
    }

    // Conditional Seeding
    if (process.env.SEED_PROD === "true") {
        console.log("Running Production Seed...");
        run("npm run db:seed:dev");
    }
}

// Build Next
run("npx next build");
