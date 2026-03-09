import { RegistryConnectorFactory } from "./RegistryConnectorFactory";
import { CompaniesHouseConnector } from "./connectors/CompaniesHouseConnector";

/**
 * Initializes the registry domain by registering known connectors.
 * In a real app, this might be called during server startup.
 */
export function initializeRegistryDomain() {
    RegistryConnectorFactory.register(new CompaniesHouseConnector());
}

export * from "./types/RegistryConnector";
export * from "./types/CanonicalRegistryRecord";
export * from "./RegistryAuthorityService";
export * from "./RegistryConnectorFactory";
export * from "./RegistryEnrichmentService";
export * from "./deriveRegistryReferencesFromGleif";
export * from "./mapping/RegistryToFieldCandidateMapper";
