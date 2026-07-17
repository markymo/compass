import { describe, it, expect } from 'vitest';
import { CCPartyDocument, CCPartyDocumentOperation } from '@prisma/client';
import { PartyDocumentLifecycleResolver } from '../PartyDocumentLifecycleResolver';

describe('PartyDocumentLifecycleResolver', () => {
    const createEvent = (
        id: string,
        instanceId: string,
        operation: CCPartyDocumentOperation,
        assertedAt: Date,
        documentId: string
    ): CCPartyDocument => ({
        id,
        partyId: 'party-1',
        documentId,
        instanceId,
        operation,
        idempotencyKey: null,
        assertedAt,
        assertedById: null,
    });

    it('should correctly group by instanceId and return the authoritative active document', () => {
        const events: CCPartyDocument[] = [
            createEvent('1', 'inst-A', CCPartyDocumentOperation.ATTACH, new Date('2026-01-01T10:00:00Z'), 'doc-A1'),
            createEvent('2', 'inst-A', CCPartyDocumentOperation.REPLACE, new Date('2026-01-01T11:00:00Z'), 'doc-A2'),
            createEvent('3', 'inst-B', CCPartyDocumentOperation.ATTACH, new Date('2026-01-01T10:00:00Z'), 'doc-B1'),
        ];

        const resolved = PartyDocumentLifecycleResolver.resolveHistories(events);

        expect(resolved.size).toBe(2);

        const instA = resolved.get('inst-A');
        expect(instA).toBeDefined();
        expect(instA?.currentDocumentId).toBe('doc-A2');
        expect(instA?.isRemoved).toBe(false);
        expect(instA?.events.length).toBe(2);

        const instB = resolved.get('inst-B');
        expect(instB).toBeDefined();
        expect(instB?.currentDocumentId).toBe('doc-B1');
    });

    it('should handle REMOVE operation by returning currentDocumentId as null', () => {
        const events: CCPartyDocument[] = [
            createEvent('1', 'inst-C', CCPartyDocumentOperation.ATTACH, new Date('2026-01-01T10:00:00Z'), 'doc-C1'),
            createEvent('2', 'inst-C', CCPartyDocumentOperation.REMOVE, new Date('2026-01-01T12:00:00Z'), 'doc-C1'),
        ];

        const resolved = PartyDocumentLifecycleResolver.resolveHistories(events);
        const instC = resolved.get('inst-C');
        
        expect(instC?.isRemoved).toBe(true);
        expect(instC?.currentDocumentId).toBeNull();
    });

    it('should resolve identical timestamps deterministically by falling back to id DESC', () => {
        const sameTime = new Date('2026-01-01T10:00:00Z');
        // 'b' is lexicographically greater than 'a', so 'b' is treated as newer
        const events: CCPartyDocument[] = [
            createEvent('a', 'inst-D', CCPartyDocumentOperation.ATTACH, sameTime, 'doc-D1'),
            createEvent('b', 'inst-D', CCPartyDocumentOperation.REPLACE, sameTime, 'doc-D2'),
        ];

        const resolved = PartyDocumentLifecycleResolver.resolveHistories(events);
        const instD = resolved.get('inst-D');
        
        expect(instD?.currentDocumentId).toBe('doc-D2');
        expect(instD?.events[0].id).toBe('b'); // The latest
    });
});
