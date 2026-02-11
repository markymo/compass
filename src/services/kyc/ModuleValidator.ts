import prisma from '@/lib/prisma';
import {
    ValidationResult
} from '@/domain/kyc/types/ValidationTypes';
// Reuse helper? Or make it shared?
// To avoid circular dependency or class coupling, I'll inline the helper or move it to utils.
// For now, inline is fine.

// Typed registry to avoid dynamic access and ensure type safety
const DELEGATES = {
    IdentityProfile: prisma.identityProfile,
    EntityInfoProfile: prisma.entityInfoProfile,
    LeiRegistration: prisma.leiRegistration,
    RelationshipProfile: prisma.relationshipProfile,
    ConstitutionalProfile: prisma.constitutionalProfile,
    ComplianceProfile: prisma.complianceProfile,
    TaxProfile: prisma.taxProfile,
    FinancialProfile: prisma.financialProfile,
    DerivativesProfile: prisma.derivativesProfile,
    TradingProfile: prisma.tradingProfile,
    ContactProfile: prisma.contactProfile,
    // Repeating
    EntityName: prisma.entityName,
    IndustryClassification: prisma.industryClassification,
    Stakeholder: prisma.stakeholder,
    TaxRegistration: prisma.taxRegistration,
    AuthorizedTrader: prisma.authorizedTrader,
    Contact: prisma.contact,
    SettlementInstruction: prisma.settlementInstruction,
};

type ModuleName = keyof typeof DELEGATES;

export class ModuleValidator {

    /**
     * Validates a module for completeness at a workflow gate.
     * Based on hardcoded rules for Phase 2C.
     */
    async validateModule(legalEntityId: string, moduleName: string): Promise<ValidationResult> {
        const errors: string[] = [];

        // Check if module is known
        if (!(moduleName in DELEGATES)) {
            return { valid: false, errors: [`Unknown module: ${moduleName}`] };
        }

        const delegate = DELEGATES[moduleName as ModuleName];

        // Fetch data
        // We treat all as findMany for simplicity in type handling, then check count
        // But 1:1 delegates don't have findMany.
        // We need to differentiate 1:1 vs 1:N in the registry or logic?
        // FieldDefinitions has 'isRepeating'. We could use that via lookup.
        // For now, let's just try/catch or check function existence check (hacky but works)

        let data: any;

        // Define repeating modules
        const REPEATING_MODULES = new Set([
            'EntityName',
            'IndustryClassification',
            'Stakeholder',
            'TaxRegistration',
            'AuthorizedTrader',
            'Contact',
            'SettlementInstruction',
        ]);

        const isRepeating = REPEATING_MODULES.has(moduleName);

        // Fetch data
        if (isRepeating) {
            // @ts-ignore - findMany exists on repeating delegates
            data = await delegate.findMany({ where: { legalEntityId } });
        } else {
            // For 1:1 profiles, legalEntityId is unique
            // @ts-ignore - findUnique exists on 1:1 delegates
            data = await delegate.findUnique({ where: { legalEntityId } });
        }

        if (!data || (Array.isArray(data) && data.length === 0)) {
            // Is empty/missing allowed? Depends on the module.
            // For a "completeness" check, usually NO.
            return { valid: false, errors: [`Module ${moduleName} has no data`] };
        }

        // Route to specific validation logic
        switch (moduleName) {
            case 'AuthorizedTrader':
                this.validateAuthorizedTrader(data as any[], errors);
                break;

            case 'IdentityProfile':
                this.validateIdentityProfile(data, errors);
                break;

            case 'Stakeholder':
                this.validateStakeholder(data as any[], errors);
                break;

            // Default: if data exists, valid for now
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    // --- Specific Module Validations ---

    private validateAuthorizedTrader(rows: any[], errors: string[]) {
        rows.forEach((row, index) => {
            // Field 100: Document OR Attestation
            const hasDoc = !!row.authorityDocumentId;
            const hasAttestation = !!row.authorityAttestationText && row.authorityAttestationText.trim().length > 0;

            if (!hasDoc && !hasAttestation) {
                errors.push(`Trader '${row.fullName || 'Unknown'}' (Row ${index + 1}) missing Proof of Authority (Field 100: Document or Attestation required)`);
            }

            if (!row.email) errors.push(`Trader '${row.fullName || 'Unknown'}' (Row ${index + 1}) missing email`);
        });
    }

    private validateIdentityProfile(data: any, errors: string[]) {
        if (!data.legalName) errors.push('Missing Legal Name');
        if (!data.leiCode) errors.push('Missing LEI');

        if (errors.length > 0) {
            console.log(`[ModuleValidator] IdentityProfile Errors. Data found:`, JSON.stringify(data, null, 2));
        }
    }

    private validateStakeholder(rows: any[], errors: string[]) {
        rows.forEach((row, index) => {
            if (row.stakeholderType === 'INDIVIDUAL') {
                if (!row.fullName) errors.push(`Stakeholder #${index + 1} (Individual) missing Full Name`);
            } else if (row.stakeholderType === 'CORPORATE') {
                if (!row.legalName) errors.push(`Stakeholder #${index + 1} (Corporate) missing Legal Name`);
            }
        });
    }
}
