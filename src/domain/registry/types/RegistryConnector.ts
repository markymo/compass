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
     * List of RegistryAuthority.registryKey values supported by this connector (e.g. ["GB_COMPANIES_HOUSE"])
     */
    readonly supportedRegistryKeys: string[];

    /**
     * Optional flag indicating if this connector supports officer fetching during ingestion.
     */
    readonly supportsOfficerFetch?: boolean;

    /**
     * Fetch and normalize data for a given registry reference
     */
    fetch(reference: RegistryReference): Promise<CanonicalRegistryRecord>;

    /**
     * Normalize raw data from the registry into the Canonical form.
     */
    normalize(rawPayload: any): CanonicalRegistryRecord;
}
