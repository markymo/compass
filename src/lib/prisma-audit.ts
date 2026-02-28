
import { Prisma } from '@prisma/client';

/**
 * Prisma Client Extension: Legacy Access Auditor
 * 
 * Prevents or logs access to tables identified as redundant in the 
 * FieldClaim migration.
 */
export const legacyAuditExtension = Prisma.defineExtension({
    name: 'legacyAudit',
    query: {
        $allModels: {
            async $allOperations({ model, operation, args, query }) {
                const legacyModels = [
                    'IdentityProfile', 'EntityInfoProfile', 'LeiRegistration',
                    'RelationshipProfile', 'ConstitutionalProfile', 'ComplianceProfile',
                    'TaxProfile', 'FinancialProfile', 'DerivativesProfile',
                    'TradingProfile', 'ContactProfile', 'TaxRegistration',
                    'AuthorizedTrader', 'Contact', 'SettlementInstruction',
                    'EntityName', 'IndustryClassification', 'Stakeholder', 'StandingDataSection'
                ];

                if (legacyModels.includes(model)) {
                    const message = `[LEGACY_ACCESS] Attempted ${operation} on legacy model: ${model}`;

                    if (process.env.STAGING_ENFORCE_NEW_SCHEMA === 'true') {
                        console.error(message);
                        throw new Error(`Legacy table access denied: ${model}. Data layer refactoring requires using FieldClaims instead of direct profile table access.`);
                    } else {
                        // Soft warning in dev/prod unless enforcement is enabled
                        console.warn(message);
                    }
                }
                return query(args);
            }
        }
    }
});
