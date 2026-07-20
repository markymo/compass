/**
 * person-or-contact-value.ts (Legacy Compatibility Shim)
 *
 * Re-exports interfaces and helpers from party-value.ts as aliases
 * to support progressive migration and prevent breaking existing code.
 */

import {
    PartyValue,
    PartyPhone,
    PartyRole,
    PartyIdentifier,
    isPartyValue,
    getPartySummary,
    isValidPartyValue,
    isRenderableActiveDirectorParty,
    isFieldPermittedByMask,
    getPartyDisplayProjection,
    formatPartialDob,
    PartyDisplayProjection
} from './party-value';

export type PersonOrContactValue = PartyValue;
export type PersonOrContactPhone = PartyPhone;
export type PersonOrContactRole = PartyRole;
export type PersonOrContactIdentifier = PartyIdentifier;

export const isPersonOrContactValue = isPartyValue;
export const getPersonOrContactSummary = getPartySummary;
export { isValidPartyValue, isRenderableActiveDirectorParty, isFieldPermittedByMask, getPartyDisplayProjection, formatPartialDob, type PartyDisplayProjection };

