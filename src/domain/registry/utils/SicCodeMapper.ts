import sicCodes from './sic_codes.json';

export class SicCodeMapper {
    private static mapping: Record<string, string> = sicCodes;

    /**
     * Look up the description for a given SIC code.
     */
    static getDescription(code: string): string | undefined {
        const cleanCode = code.trim();
        return this.mapping[cleanCode];
    }

    /**
     * Map a list of codes to their descriptions.
     */
    static mapCodes(codes: string[]): Array<{ code: string; description?: string }> {
        return codes.map(code => ({
            code,
            description: this.getDescription(code)
        }));
    }
}
