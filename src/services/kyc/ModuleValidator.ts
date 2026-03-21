import prisma from '@/lib/prisma';
import { KycStateService } from '@/lib/kyc/KycStateService';
import { getFieldDefinition } from '@/domain/kyc/FieldDefinitions';
import { ValidationResult } from '@/domain/kyc/types/ValidationTypes';

export class ModuleValidator {

    /**
     * Validates a module for completeness at a workflow gate.
     * Transitioned to use KycStateService for FieldClaim-backed validation.
     */
    async validateModule(legalEntityId: string, moduleName: string): Promise<ValidationResult> {
        const errors: string[] = [];

        // Map ModuleName to Field Numbers for validation
        switch (moduleName) {
            case 'IdentityProfile': {
                const results = await Promise.all([
                    KycStateService.getAuthoritativeValue({ subjectLeId: legalEntityId }, 3), // Legal Name
                    KycStateService.getAuthoritativeValue({ subjectLeId: legalEntityId }, 2), // LEI
                ]);
                if (!results[0]?.value) errors.push('Missing Legal Name (Field 3)');
                if (!results[1]?.value) errors.push('Missing LEI (Field 2)');
                break;
            }

            case 'AuthorizedTrader': {
                // Fetch collection for primary field (96: Full Name)
                const traders = await KycStateService.getAuthoritativeCollection({ subjectLeId: legalEntityId }, 96);
                if (traders.length === 0) {
                    errors.push('Module AuthorizedTrader has no data');
                } else {
                    // For each trader found via Field 96, check its other fields using the same instanceId
                    for (const trader of traders) {
                        const instanceId = trader.instanceId;
                        // email (97), proof of authority (100)
                        const [email, proof] = await Promise.all([
                            this.getScopedInstanceValue(legalEntityId, 97, instanceId),
                            this.getScopedInstanceValue(legalEntityId, 100, instanceId)
                        ]);

                        const traderName = trader.value || 'Unknown';
                        if (!email) errors.push(`Trader '${traderName}' missing email (Field 97)`);
                        if (!proof) errors.push(`Trader '${traderName}' missing Proof of Trading Authority (Field 100)`);
                    }
                }
                break;
            }

            case 'Stakeholder': {
                // Stakeholders can be Individuals (65) or Corporates (69)
                const [individuals, corporates] = await Promise.all([
                    KycStateService.getAuthoritativeCollection({ subjectLeId: legalEntityId }, 65),
                    KycStateService.getAuthoritativeCollection({ subjectLeId: legalEntityId }, 69),
                ]);

                if (individuals.length === 0 && corporates.length === 0) {
                    errors.push('Module Stakeholder has no data');
                }
                // Specific row validations could be added here similar to AuthorizedTrader
                break;
            }

            default:
                // For other modules, we just check if any claims exist for fields in that "module"
                // This is a loose check until more specific rules are added.
                const claims = await prisma.fieldClaim.findFirst({
                    where: { subjectLeId: legalEntityId }
                });
                if (!claims) errors.push(`Module ${moduleName} has no data`);
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    private async getScopedInstanceValue(leId: string, fieldNo: number, instanceId?: string) {
        if (!instanceId) return null;
        const claims = await prisma.fieldClaim.findMany({
            where: {
                subjectLeId: leId,
                fieldNo,
                instanceId,
                status: { in: ['VERIFIED', 'ASSERTED'] }
            },
            orderBy: { assertedAt: 'desc' },
            take: 1
        });
        return claims[0]?.valueText || claims[0]?.valueNumber || claims[0]?.valueJson || null;
    }

}
