/**
 * source-priority-config.ts
 *
 * Pure constants for source-type priority defaults.
 * ✅ Safe to import from BOTH client and server components.
 *
 * ## Priority semantics
 * Lower number = higher authority (the claim is preferred in `pickWinner`).
 *
 * ## Layered resolution (highest → lowest precedence):
 *   1. DB: SystemSetting key="source_priority_defaults" (editable by super users)
 *      → loaded via getSourcePriorityConfig() in source-priority-service.server.ts
 *   2. CODE_DEFAULTS below (compile-time safety net / first-boot values)
 *
 * ## Where this is consumed
 *  - KycStateService.pickWinner         — read-time winner selection
 *  - KycWriteService.evaluateOverwrite  — write-time gate
 *  - SourcePriorityPanel (client UI)    — display + reset-to-defaults
 *
 * ## Changing defaults
 *  - Per-deployment runtime: edit via /app/admin/super (super user UI)
 *  - Compile-time baseline: update CODE_DEFAULTS below
 *  - Per-field, per-RA overrides: use SourceFieldMapping table in the mapping admin UI
 */

export const SYSTEM_SETTING_KEY = "source_priority_defaults";

/** Priority for USER_INPUT — always wins, never stored in DB or overridden. */
export const USER_INPUT_PRIORITY = 0;

/** Unknown/last-resort sentinel when no mapping and no fallback entry exists. */
export const UNKNOWN_SOURCE_FALLBACK_PRIORITY = 1000;

/**
 * Hard-coded baseline. Used when:
 *  - The DB setting hasn't been configured yet (first boot)
 *  - The DB is unavailable
 *  - A source type is not present in the DB setting
 */
export const CODE_DEFAULTS: Record<string, number> = {
    GLEIF:                  500,
    REGISTRATION_AUTHORITY: 500,
    COMPANIES_HOUSE:        500, // legacy enum value — treated same as REGISTRATION_AUTHORITY
    AI_EXTRACTION:          800,
    SYSTEM_DERIVED:         900,
};

/**
 * Synchronous priority lookup from code defaults only (no DB).
 * Use in hot paths where the DB config hasn't been pre-loaded.
 */
export function getFallbackPriority(sourceType: string): number {
    return CODE_DEFAULTS[sourceType] ?? UNKNOWN_SOURCE_FALLBACK_PRIORITY;
}

/**
 * Resolve priority from a pre-loaded config object.
 * Pass the result of getSourcePriorityConfig() to avoid re-querying DB.
 */
export function getPriorityFromConfig(
    sourceType: string,
    config: Record<string, number>
): number {
    return config[sourceType] ?? UNKNOWN_SOURCE_FALLBACK_PRIORITY;
}
