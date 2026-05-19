// Shared constants and types for the Mapping Workbench demo entity picker.
// No "use server" directive — this is imported by both server actions and client components.

export const DEFAULT_GLEIF_LEI     = "213800SN8QHYGA7QUF79";
export const DEFAULT_CH_COMPANY_NO = "14059418";
export const DEFAULT_FR_SIREN      = "542051180";

export interface WbEntitySearchResult {
    id:      string;   // LEI | company number | SIREN
    name:    string;
    status?: string;
    extra?:  string;   // country code, incorporation date, etc.
}
