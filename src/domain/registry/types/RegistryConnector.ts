import { RegistryReference } from "@prisma/client";
import { CanonicalRegistryRecord } from "./CanonicalRegistryRecord";

/**
 * Interface that every national registry connector must implement.
 */
export interface IRegistryConnector {
    /**
     * Unique internal key for this connector (e.g. "CompaniesHouseConnector")
     */
    readonly connectorKey: string;

    /**
     * Fetch and normalize data for a given registry reference
     */
    fetch(reference: RegistryReference): Promise<CanonicalRegistryRecord>;

    /**
     * Normalize raw data from the registry into the Canonical form.
     */
    normalize(rawPayload: any): CanonicalRegistryRecord;

    /**
     * Check if this connector can handle the given authority ID (e.g. RA000585)
     */
    supports(authorityId: string): boolean;
}
