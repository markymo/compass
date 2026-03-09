import { IRegistryConnector } from "./types/RegistryConnector";

export class RegistryConnectorFactory {
    private static connectors: Map<string, IRegistryConnector> = new Map();

    /**
     * Register a new registry connector.
     */
    static register(connector: IRegistryConnector) {
        this.connectors.set(connector.connectorKey, connector);
    }

    /**
     * Get the correct connector for a given registry authority ID.
     */
    static getConnectorForAuthority(authorityId: string): IRegistryConnector | null {
        for (const connector of this.connectors.values()) {
            if (connector.supports(authorityId)) {
                return connector;
            }
        }
        return null;
    }

    /**
     * Get a connector by its key.
     */
    static getConnectorByKey(key: string): IRegistryConnector | null {
        return this.connectors.get(key) || null;
    }

    /**
     * Map an EvidenceProvider enum to its corresponding connector.
     */
    static getConnectorForProvider(provider: string): IRegistryConnector | null {
        if (!provider) return null;
        // e.g. COMPANIES_HOUSE -> CompaniesHouseConnector
        const key = provider
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join('') + 'Connector';
        
        return this.getConnectorByKey(key);
    }
}
