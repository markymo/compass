/**
 * Fail-safe preflight guard for DB-backed Vitest integration tests.
 * 
 * Invariant:
 * 1. Must explicitly have ONPRO_DB_TEST_ENV='uat' set.
 * 2. DATABASE_URL must exist and point to the authorized staging/UAT Neon database (ep-holy-paper-*).
 * 3. Never allow execution against development (ep-solitary-mouse-*) or production databases.
 */
export function assertUatDbTestEnv() {
    const testEnv = process.env.ONPRO_DB_TEST_ENV;
    if (testEnv !== 'uat') {
        throw new Error(
            `[DB TEST REFUSAL] This integration test performs live database operations and requires explicit environment authorization.\n` +
            `Expected ONPRO_DB_TEST_ENV='uat', but received '${testEnv || 'undefined'}'.\n` +
            `Run with: npx -y dotenv-cli -e .env.uat.local -- env ONPRO_DB_TEST_ENV=uat npx vitest <test-file>`
        );
    }

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        throw new Error(`[DB TEST REFUSAL] DATABASE_URL is missing. Please provide .env.uat.local.`);
    }

    try {
        const u = new URL(dbUrl);
        const host = u.host.toLowerCase();
        
        // Disallow dev/prod solitary-mouse endpoint
        if (host.includes('solitary-mouse')) {
            throw new Error(
                `[DB TEST REFUSAL] Target DATABASE_URL host '${host}' is the DEV/PROD database! Live tests are strictly forbidden on this database.`
            );
        }

        // Require authorized staging/uat endpoint (ep-holy-paper)
        if (!host.includes('holy-paper') && !host.includes('localhost') && !host.includes('127.0.0.1')) {
            throw new Error(
                `[DB TEST REFUSAL] Target DATABASE_URL host '${host}' is not recognized as an authorized staging/UAT database (must be ep-holy-paper-* or local).`
            );
        }
    } catch (err: any) {
        if (err.message.startsWith('[DB TEST REFUSAL]')) throw err;
        throw new Error(`[DB TEST REFUSAL] Invalid DATABASE_URL format: ${err.message}`);
    }
}
