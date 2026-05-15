import { RegistryConnectorFactory } from "./RegistryConnectorFactory";
import { CompaniesHouseConnector } from "./connectors/CompaniesHouseConnector";
import { OfficialGermanRegistryConnector } from "./connectors/OfficialGermanRegistryConnector";
import { FranceRechercheEntreprisesConnector } from "./connectors/FranceRechercheEntreprisesConnector";

/**
 * Initializes the registry domain by registering known connectors.
 * In a real app, this might be called during server startup.
 */
export function initializeRegistryDomain() {
    RegistryConnectorFactory.register(new CompaniesHouseConnector());
    RegistryConnectorFactory.register(new OfficialGermanRegistryConnector());
    RegistryConnectorFactory.register(new FranceRechercheEntreprisesConnector());
}

export * from "./types/RegistryConnector";
export * from "./types/CanonicalRegistryRecord";
export * from "./RegistryAuthorityService";
export * from "./RegistryConnectorFactory";
export * from "./RegistryEnrichmentService";
export * from "./deriveRegistryReferencesFromGleif";
export * from "./LegalEntityEnrichmentService";
