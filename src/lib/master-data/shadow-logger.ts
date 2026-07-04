import { FieldDisplayModel } from './field-display-model';

/**
 * Shadow logger for Phase 1 Master Data rendering migration.
 * Compares the output of the new FieldInterpreter against the legacy formatters.
 * 
 * Set ENABLE_MD_SHADOW_LOGGING=true in your environment to enable verbose logging in local development.
 * Do not enable in production to avoid log pollution.
 */

function isShadowLoggingEnabled(): boolean {
    return process.env.NODE_ENV === 'development' && process.env.ENABLE_MD_SHADOW_LOGGING === 'true';
}

export function compareAndLogShadowRender(
    oldFormattedValue: string,
    newModel: FieldDisplayModel
): void {
    // Both might return different placeholder texts for empty states (e.g. "" vs "None").
    // We only care about populated values that render differently.
    const oldText = (oldFormattedValue || '').trim();
    const newText = (newModel.textSummary || '').trim();

    if (oldText === newText) {
        return; // Match!
    }

    if (!isShadowLoggingEnabled()) {
        return; // Mismatch, but we are suppressing logs
    }

    console.warn(`[MD_SHADOW_MISMATCH] Field #${newModel.fieldNo} ("${newModel.label}")`);
    console.warn(`  ↳ Old: "${oldText}"`);
    console.warn(`  ↳ New: "${newText}"`);
    console.warn(`  ↳ State: ${newModel.state}`);
    if (newModel.source) {
        console.warn(`  ↳ Source: ${newModel.source.type} (${newModel.source.reference || 'none'})`);
    }
}
