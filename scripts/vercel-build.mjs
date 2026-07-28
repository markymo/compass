import 'dotenv/config';
import { execSync } from "node:child_process";

function run(cmd) {
    console.log(`\n> ${cmd}`);
    execSync(cmd, { stdio: "inherit" });
}

function runWithRetry(cmd, maxRetries = 4, retryDelayMs = 10000) {
    let attempts = 0;
    while (attempts < maxRetries) {
        try {
            console.log(`\n> ${cmd} (Attempt ${attempts + 1}/${maxRetries})`);
            execSync(cmd, { stdio: "inherit" });
            return;
        } catch (e) {
            attempts++;
            if (attempts >= maxRetries) {
                console.error(`\nCommand failed after ${maxRetries} attempts: ${cmd}`);
                console.error(`\n[Neon Database Connection Troubleshooting]`);
                console.error(`If error P1001 (Can't reach database server) persists:`);
                console.error(`1. Check Neon Console to ensure the compute endpoint is active.`);
                console.error(`2. Ensure DIRECT_URL and DATABASE_URL in Vercel contain '?sslmode=require&connect_timeout=30'.`);
                throw e;
            }
            console.log(`\nCommand failed. Retrying in ${retryDelayMs / 1000} seconds to allow serverless DB cold-start wake up...`);
            execSync(`node -e "setTimeout(() => {}, ${retryDelayMs})"`);
        }
    }
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
    console.log("Running Preview migrations (migrate deploy)…");
    try {
        runWithRetry("npx prisma migrate deploy", 4, 10000);
    } catch (error) {
        console.log("Migration failed. Attempting to resolve known failed migration 20260717200000_remove_legacy_documents...");
        try {
            run("npx prisma migrate resolve --rolled-back 20260717200000_remove_legacy_documents");
            runWithRetry("npx prisma migrate deploy", 2, 10000);
        } catch (resolveError) {
            throw error; // throw original error
        }
    }

    // Seed automatically for 'dev' branch or if forced
    if (process.env.VERCEL_GIT_COMMIT_REF === "dev" || process.env.SEED_PREVIEW === "true") {
        console.log("Running Preview Seed (Auto-detected 'dev' branch)...");
        run("npm run db:seed:dev");
    }
}

// Production migrations are gated (prevents accidental prod schema changes)
if (vercelEnv === "production") {
    if (process.env.ALLOW_PROD_MIGRATIONS === "true") {
        console.log("Running Production migrations (migrate deploy)...");
        runWithRetry("npx prisma migrate deploy", 4, 10000);
    } else {
        console.log("Skipping Production migrations (ALLOW_PROD_MIGRATIONS != true).");
    }

    // Conditional Seeding
    if (process.env.SEED_PROD === "true") {
        console.log("Running Production Seed...");
        run("npm run db:seed:dev");
    }
}

// Build Next
run("npx next build");
