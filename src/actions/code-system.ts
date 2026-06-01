"use server";

/**
 * code-system.ts
 *
 * Server actions for controlled-vocabulary code systems.
 *
 * All code system data is resolved server-side. The client receives only
 * serialised { code, label } entries — never the raw JSON data files.
 */

import { CODE_SYSTEMS } from '@/lib/master-data/code-systems';
import { SicCodeMapper } from '@/domain/registry/utils/SicCodeMapper';

export interface CodeSystemEntry {
    code: string;
    label: string;
}

/**
 * Returns all entries for a registered code system, sorted by code ascending.
 *
 * Called once by CodeListPickerPopover on first open; result is cached in
 * component state for the lifetime of the popover session.
 *
 * Returns [] for unknown/unregistered code systems.
 *
 * Extend the dispatch block below when adding future code systems (NAF, WZ, etc.).
 */
export async function getCodeSystemEntries(
    codeSystem: string
): Promise<CodeSystemEntry[]> {
    if (!CODE_SYSTEMS[codeSystem]) {
        console.warn(`[getCodeSystemEntries] Unknown code system: "${codeSystem}"`);
        return [];
    }

    let entries: CodeSystemEntry[];

    switch (codeSystem) {
        case 'SIC_2007_UK': {
            entries = SicCodeMapper.getAllEntries();
            break;
        }

        // Future code systems — add a case block + data source per system:
        // case 'NAF_2008': { ... }
        // case 'ISO_3166_1': { ... }

        default:
            return [];
    }

    // Sort by code ascending (numeric-string sort: '10110' before '20000')
    entries.sort((a, b) => a.code.localeCompare(b.code));

    return entries;
}
