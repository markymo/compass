import { IRegistryConnector } from "./types/RegistryConnector";
import { RegistryAuthorityService } from "./RegistryAuthorityService";

export class RegistryConnectorFactory {
    private static connectors: Map<string, IRegistryConnector> = new Map();

    /**
     * Register a new registry connector.
     */
    static register(connector: IRegistryConnector) {
        this.connectors.set(connector.connectorKey, connector);
    }

    /**
     * Get the correct connector for a physical registry authority ID (e.g. "RA000585", "RA000587").
     * Loads RegistryAuthority, obtains its registryKey, and selects connector matching registryKey.
     */
    static async getConnectorForAuthorityId(authorityId: string): Promise<IRegistryConnector | null> {
        const registryKey = await RegistryAuthorityService.getRegistryKey(authorityId);
        if (!registryKey) return null;
        return this.getConnectorForRegistryKey(registryKey);
    }

    /**
     * Async alias for getConnectorForAuthorityId.
     */
    static async getConnectorForAuthority(authorityId: string): Promise<IRegistryConnector | null> {
        return this.getConnectorForAuthorityId(authorityId);
    }

    /**
     * Selects connector matching a given registryKey (e.g. "GB_COMPANIES_HOUSE").
     */
    static getConnectorForRegistryKey(registryKey: string): IRegistryConnector | null {
        if (!registryKey) return null;
        for (const connector of this.connectors.values()) {
            if (connector.supportedRegistryKeys?.includes(registryKey)) {
                return connector;
            }
        }
        return null;
    }

    /**
     * Get a connector by its connectorKey (e.g. "CompaniesHouseConnector").
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
