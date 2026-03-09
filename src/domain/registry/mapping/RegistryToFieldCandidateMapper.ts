import { CanonicalRegistryRecord } from "../types/CanonicalRegistryRecord";
import { FieldCandidate } from "@/services/kyc/normalization/types";

/**
 * Maps a standardized CanonicalRegistryRecord into a set of FieldCandidate objects
 * that can be evaluated for proposals or direct updates.
 */
export class RegistryToFieldCandidateMapper {
    /**
     * Maps canonical registry fields to Master Schema field numbers.
     */
    static mapToCandidates(record: CanonicalRegistryRecord, evidenceId: string): FieldCandidate[] {
        const candidates: FieldCandidate[] = [];
        
        // Define common candidate context
        const context = {
            evidenceId,
            source: record.sourceType as any, // Cast to match FieldCandidate union if necessary
            confidence: 1.0,
        };

        // 3: Entity Name
        if (record.entityName) {
            candidates.push({ ...context, fieldNo: 3, value: record.entityName });
        }

        // 26: Entity Status
        if (record.entityStatus) {
            candidates.push({ ...context, fieldNo: 26, value: record.entityStatus });
        }

        // 27: Incorporation Date
        if (record.incorporationDate) {
            candidates.push({ 
                ...context, 
                fieldNo: 27, 
                value: record.incorporationDate instanceof Date 
                    ? record.incorporationDate 
                    : new Date(record.incorporationDate) 
            });
        }

        // Address Mapping
        if (record.registeredAddress) {
            const addr = record.registeredAddress;
            if (addr.lines?.[0]) {
                candidates.push({ ...context, fieldNo: 6, value: addr.lines[0] });
            }
            if (addr.city) {
                candidates.push({ ...context, fieldNo: 7, value: addr.city });
            }
            if (addr.region) {
                candidates.push({ ...context, fieldNo: 8, value: addr.region });
            }
            if (addr.country) {
                candidates.push({ ...context, fieldNo: 9, value: addr.country });
            }
            if (addr.postalCode) {
                candidates.push({ ...context, fieldNo: 10, value: addr.postalCode });
            }
        }

        // Identifiers
        const regNum = (record.identifiers || []).find(i => i.type === 'COMPANY_NUMBER' || i.type === 'REGISTRATION_NUMBER');
        if (regNum) {
            // Assuming F11 is a field for local registration numbers
            candidates.push({ ...context, fieldNo: 11, value: regNum.value });
        }

        return candidates;
    }
}
