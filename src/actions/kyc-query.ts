"use server";

import prisma from "@/lib/prisma";
import { getFieldDefinition } from "@/domain/kyc/FieldDefinitions";
// @ts-ignore
import { mapGleifPayloadToFieldCandidates } from "@/services/kyc/normalization/GleifNormalizer";
import { ProvenanceMetadata } from "@/domain/kyc/types/ProvenanceTypes";

/**
 * Detailed view of a field:
 * - Current value (from Profile table)
 * - History of changes (from MasterDataEvent table)
 * - Available Candidates (re-derived from raw Evidence or Stored Data)
 */
export type FieldDetailData = {
    fieldNo: number;
    definition: any; // Serialized FieldDefinition
    current: {
        value: any;
        source: string;
        timestamp: Date | null;
        verifiedBy?: string | null;
        confidence?: number;
    } | null;
    history: Array<{
        id: string;
        oldValue: any;
        newValue: any;
        source: string;
        reason?: string | null;
        actorId?: string | null;
        timestamp: Date;
    }>;
    candidates: Array<{
        source: string;
        value: any;
        confidence: number;
        evidenceId?: string;
    }>;
};

export async function getFieldDetail(legalEntityId: string, fieldNo: number): Promise<FieldDetailData | null> {
    console.log(`[getFieldDetail] Starting for LE=${legalEntityId}, Field=${fieldNo}`);

    try {
        const def = getFieldDefinition(fieldNo);
        if (!def) {
            console.error(`[getFieldDetail] Field definition not found for FieldNo=${fieldNo}`);
            return null;
        }

        console.log(`[getFieldDetail] Resolved FieldDefinition: ${def.fieldName} (${def.model}.${def.field})`);

        // 1. Fetch Current Value & Metadata from Profile
        const prismaClientKey = def.model.charAt(0).toLowerCase() + def.model.slice(1);
        console.log(`[getFieldDetail] Using Prisma delegate: ${prismaClientKey}`);

        // @ts-ignore
        const delegate = prisma[prismaClientKey];

        if (!delegate) {
            console.error(`[getFieldDetail] Prisma delegate '${prismaClientKey}' is undefined! Check client/model name.`);
            throw new Error(`Prisma delegate not found for model ${def.model}`);
        }

        // @ts-ignore
        const record = await delegate.findFirst({
            where: { legalEntityId },
        });

        console.log(`[getFieldDetail] Profile record found: ${!!record}`);

        let current = null;
        if (record) {
            // Assume 'meta' exists on all profiles
            const meta = (record.meta as Record<string, ProvenanceMetadata>) || {};
            const fieldMeta = meta[def.field!] || {};

            current = {
                value: record[def.field!],
                source: fieldMeta.source || 'UNKNOWN',
                timestamp: fieldMeta.timestamp ? new Date(fieldMeta.timestamp) : null,
                verifiedBy: fieldMeta.verified_by,
                confidence: fieldMeta.confidence
            };
        }

        // 2. Fetch History from MasterDataEvent
        console.log(`[getFieldDetail] Fetching history...`);
        // @ts-ignore
        const historyEvents = await prisma.masterDataEvent.findMany({
            where: {
                legalEntityId,
                fieldNo
            },
            orderBy: {
                timestamp: 'desc'
            },
            take: 20 // Limit history
        });

        const history = historyEvents.map((evt: any) => ({
            id: evt.id,
            oldValue: evt.oldValue,
            newValue: evt.newValue,
            source: evt.source,
            reason: evt.reason,
            actorId: evt.actorId,
            timestamp: evt.timestamp
        }));

        // 3. Derive Candidates from Evidence (e.g. GLEIF)
        console.log(`[getFieldDetail] Fetching candidates...`);
        const candidates: any[] = [];

        // @ts-ignore
        const identityProfile = await prisma.identityProfile.findUnique({
            where: { legalEntityId },
            include: { clientLE: true }
        });

        if (identityProfile?.clientLE?.gleifData) {
            // @ts-ignore
            const gleifPayload = identityProfile.clientLE.gleifData;

            const gleifCandidates = mapGleifPayloadToFieldCandidates(
                gleifPayload,
                'LATEST_STORED_GLEIF'
            );

            const relevant = gleifCandidates.filter((c: any) => c.fieldNo === fieldNo);

            relevant.forEach((c: any) => {
                candidates.push({
                    source: c.source,
                    value: c.value,
                    confidence: c.confidence,
                    evidenceId: c.evidenceId
                });
            });
        }


        console.log(`[getFieldDetail] Success. Returning data.`);

        // Ensure serialization safety (replace undefined with null)
        const safeDefinition = JSON.parse(JSON.stringify(def));

        return {
            fieldNo,
            definition: safeDefinition,
            current,
            history: history.map((h: any) => ({
                ...h,
                reason: h.reason ?? null,
                actorId: h.actorId ?? null
            })),
            candidates: candidates.map((c: any) => ({
                ...c,
                evidenceId: c.evidenceId ?? null
            }))
        };

    } catch (error) {
        console.error(`[getFieldDetail] CRITICAL ERROR:`, error);
        throw error;
    }
}
