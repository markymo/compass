import prisma from "@/lib/prisma";
import { CCPartyData, isCCPartyData } from "@/lib/master-data/party-v2";

export class CCPartyValidationError extends Error {
    constructor(public code: string, message: string) {
        super(message);
        this.name = 'CCPartyValidationError';
    }
}

export type CreateCCPartyArgs = {
    clientLEId: string;
    data: CCPartyData;
    createdByUserId?: string | null;
    createdFromClaimId?: string | null;
};

export type UpdateCCPartyArgs = {
    ccPartyId: string;
    clientLEId: string;
    data: CCPartyData;
    updatedByUserId?: string | null;
};

export class CCPartyService {
    /**
     * Get a CCParty by ID, scoped to a client LE.
     */
    static async getById(args: { ccPartyId: string; clientLEId: string }) {
        const party = await prisma.cCParty.findUnique({
            where: { id: args.ccPartyId }
        });
        
        if (!party) {
            return null;
        }

        if (party.clientLEId !== args.clientLEId) {
            throw new CCPartyValidationError('CCPARTY_CLIENT_LE_MISMATCH', 'CCParty does not belong to the requested Client LE.');
        }

        return party;
    }

    /**
     * Create a new canonical v2 CCParty.
     */
    static async create(args: CreateCCPartyArgs) {
        await this.validate(args.data, args.clientLEId, args.createdFromClaimId);

        return await prisma.cCParty.create({
            data: {
                clientLEId: args.clientLEId,
                data: args.data as any,
                visibility: "CLIENT_LE",
                createdByUserId: args.createdByUserId || null,
                updatedByUserId: args.createdByUserId || null,
                createdFromClaimId: args.createdFromClaimId || null
            }
        });
    }

    /**
     * Update an existing CCParty using complete aggregate replacement.
     */
    static async update(args: UpdateCCPartyArgs) {
        // 1. Verify existence and scope
        const existing = await this.getById({ ccPartyId: args.ccPartyId, clientLEId: args.clientLEId });
        if (!existing) {
            throw new CCPartyValidationError('CCPARTY_NOT_FOUND', 'CCParty not found.');
        }

        // 2. Validate new data
        await this.validate(args.data, args.clientLEId, undefined); // createdFromClaimId doesn't apply to updates

        // 3. Persist
        return await prisma.cCParty.update({
            where: { id: args.ccPartyId },
            data: {
                data: args.data as any,
                updatedByUserId: args.updatedByUserId || null,
                // Preserved: createdByUserId, createdAt, createdFromClaimId, visibility
            }
        });
    }

    private static async validate(data: any, clientLEId: string, createdFromClaimId: string | null | undefined) {
        if (!data || typeof data !== 'object') {
            throw new CCPartyValidationError('INVALID_CCPARTY_DATA', 'Data must be an object.');
        }

        if (data.schemaVersion !== 2) {
            throw new CCPartyValidationError('INVALID_SCHEMA_VERSION', 'Only schemaVersion 2 is supported by this service.');
        }

        if (!isCCPartyData(data)) {
            throw new CCPartyValidationError('INVALID_CCPARTY_DATA', 'Data failed canonical validation rules.');
        }

        if ('visibility' in data) {
            throw new CCPartyValidationError('INVALID_CCPARTY_DATA', 'Embedded visibility is not permitted in v2 JSON.');
        }

        // Validate createdFromClaimId
        if (createdFromClaimId) {
            const claim = await prisma.fieldClaim.findUnique({
                where: { id: createdFromClaimId }
            });
            if (!claim) {
                throw new CCPartyValidationError('CLAIM_NOT_FOUND', 'The provided createdFromClaimId does not exist.');
            }
            if (claim.clientLeScopeId !== clientLEId) {
                throw new CCPartyValidationError('CLAIM_CLIENT_LE_MISMATCH', 'The provided createdFromClaimId belongs to a different Client LE.');
            }
        }

        // Validate CCAddress references
        const addressIds = new Set<string>();

        if (data.partyType === 'INDIVIDUAL' && data.homeAddressRef) {
            addressIds.add(data.homeAddressRef.ccAddressId);
        } else if (data.partyType === 'TEAM' && data.correspondenceAddressRef) {
            addressIds.add(data.correspondenceAddressRef.ccAddressId);
        } else if (data.partyType === 'ORGANISATION' && data.registeredAddressRef) {
            addressIds.add(data.registeredAddressRef.ccAddressId);
        }

        if (Array.isArray(data.roles)) {
            data.roles.forEach((r: any) => {
                if (r.correspondenceAddressRef) {
                    addressIds.add(r.correspondenceAddressRef.ccAddressId);
                }
            });
        }

        if (addressIds.size > 0) {
            const ids = Array.from(addressIds);
            const addresses = await prisma.cCAddress.findMany({
                where: { id: { in: ids } },
                select: { id: true, clientLEId: true }
            });

            const foundMap = new Map<string, any>(addresses.map((a: any) => [a.id, a]));

            for (const id of ids) {
                const addr = foundMap.get(id);
                if (!addr) {
                    throw new CCPartyValidationError('CCADDRESS_NOT_FOUND', `CCAddress reference not found: ${id}`);
                }
                if (addr.clientLEId !== clientLEId) {
                    throw new CCPartyValidationError('CCADDRESS_CLIENT_LE_MISMATCH', `CCAddress reference ${id} belongs to a different Client LE.`);
                }
            }
        }
    }
}
