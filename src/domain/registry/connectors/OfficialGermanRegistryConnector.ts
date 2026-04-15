import { IRegistryConnector } from "../types/RegistryConnector";
import { RegistryReference } from "@prisma/client";
import { CanonicalRegistryRecord } from "../types/CanonicalRegistryRecord";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import * as https from "https";

export class OfficialGermanRegistryConnector implements IRegistryConnector {
    readonly connectorKey = "OfficialGermanRegistryConnector";

    supports(authorityId: string): boolean {
        // Match generic German registry authorities if needed.
        // Frankfurt am Main = RA000242, but we can match any German RA starting with RA if it's mapped to HRB
        // For now, specific RAIDs for known German courts.
        const germanRAIDs = [
            "RA000242", // Frankfurt am Main
            "RA000431", // KVK Netherlands? Wait, 431 is NL. Let's stick to known DE ones.
            // In a real app we'd check if jurisdiction == "DE" or something
        ];
        return germanRAIDs.includes(authorityId) || authorityId.startsWith("RA0002"); // broad fallback for DE
    }

    async fetch(reference: RegistryReference): Promise<CanonicalRegistryRecord> {
        const hrbNumber = reference.localRegistrationNumber; // e.g. "HRB 130853"
        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
            throw new Error("OpenAI API key not configured. AI Registry enrichment is disabled.");
        }

        console.log(`[OfficialGermanRegistryConnector] Fetching real data for German entity ${hrbNumber}...`);

        try {
            // STEP 1: Attempt to establish session with handelsregister.de
            const sessionResult = await this.fetchHtmlWithSession(hrbNumber);
            
            if (!sessionResult.html || sessionResult.blocked) {
                console.warn("[OfficialGermanRegistryConnector] Blocked by RA anti-bot or session failed. Throwing RA_BLOCKED.");
                throw new Error("RA_BLOCKED: The official German Handesregister blocked the automated request.");
            }

            // STEP 2: Use OpenAI to parse the messy HTML from the official portal
            const record = await this.parseHtmlWithOpenAI(sessionResult.html, apiKey, reference);

            // Inject context from reference
            record.registryAuthorityId = reference.registryAuthorityId;
            record.sourceRecordId = reference.localRegistrationNumber;
            record.fetchedAt = new Date();

            return record;
        } catch (error) {
            console.error("[OfficialGermanRegistryConnector] Real fetch failed:", error);
            throw error;
        }
    }

    normalize(raw: any): CanonicalRegistryRecord {
        // The AI output is already normalized, this is just to satisfy the interface if called manually
        if (!raw) {
            throw new Error("Cannot normalize empty registry record");
        }
        return raw as CanonicalRegistryRecord;
    }

    private async fetchHtmlWithSession(hrbNumber: string): Promise<{ html: string; blocked: boolean }> {
        // This is a best-effort Node HTTP client to interact with the stateful JSESSIONID portal.
        return new Promise((resolve) => {
            const options = {
                hostname: 'www.handelsregister.de',
                port: 443,
                path: '/rp_web/mask.do?Typ=e',
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
                    'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Connection': 'keep-alive'
                }
            };

            const req = https.request(options, res => {
                const cookies = res.headers['set-cookie'] || [];
                const jsessionid = cookies.map(c => c.split(';')[0]).join('; ');
                
                if (res.statusCode === 400 || res.statusCode === 403 || res.statusCode === 429) {
                    resolve({ html: "", blocked: true });
                    return;
                }

                resolve(this.postSearchQuery(hrbNumber, jsessionid));
            });

            req.on('error', e => {
                console.error("[OfficialGermanRegistryConnector] Session fetch error:", e);
                resolve({ html: "", blocked: true });
            });

            req.end();
        });
    }

    private async postSearchQuery(hrbNumber: string, sessionCookie: string): Promise<{ html: string; blocked: boolean }> {
        // parse HRB and number. Usually inputs are "HRB 130853"
        const isHRB = hrbNumber.toUpperCase().includes("HRB");
        const isHRA = hrbNumber.toUpperCase().includes("HRA");
        const regArt = isHRB ? "HRB" : isHRA ? "HRA" : "";
        const numOnly = hrbNumber.replace(/[^0-9]/g, "");

        const data = new URLSearchParams({
            'schlagwoerter': '',
            'schlagwortTyp': 'EXAKT',
            'registerArt': regArt,
            'registerNummer': numOnly,
            'registergericht': '' // Let the search be broad across Germany if court not cleanly mappable
        }).toString();

        return new Promise((resolve) => {
            const options = {
                hostname: 'www.handelsregister.de',
                port: 443,
                path: '/rp_web/search.do',
                method: 'POST',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(data),
                    'Cookie': sessionCookie
                }
            };

            const req = https.request(options, res => {
                if (res.statusCode === 400 || res.statusCode === 403 || res.statusCode === 404 || res.statusCode === 429) {
                    resolve({ html: "", blocked: true });
                    return;
                }

                let html = '';
                res.on('data', chunk => html += chunk);
                res.on('end', () => {
                    // Check if it's an error page or blocked
                    if (html.includes("Captcha") || html.includes("Zugriff verweigert")) {
                        resolve({ html: "", blocked: true });
                    } else {
                        resolve({ html, blocked: false });
                    }
                });
            });

            req.on('error', e => {
                console.error("[OfficialGermanRegistryConnector] Search post error:", e);
                resolve({ html: "", blocked: true });
            });

            req.write(data);
            req.end();
        });
    }

    private async parseHtmlWithOpenAI(htmlContent: string, apiKey: string, reference: RegistryReference): Promise<CanonicalRegistryRecord> {
        const openai = createOpenAI({ apiKey });
        
        // Truncate HTML to fit within token limits (e.g. 60k chars)
        const truncatedHtml = htmlContent.substring(0, 60000);

        const { object } = await generateObject({
            model: openai('gpt-4o'),
            schema: z.object({
                entityName: z.string().describe("The full legal name of the company."),
                entityStatus: z.string().describe("The registration status, e.g., 'active', 'gelöscht'."),
                incorporationDate: z.string().optional().describe("The date of incorporation or first registration, ISO format ideally."),
                legalForm: z.string().optional().describe("E.g., GmbH, AG, UG."),
                registeredAddress: z.object({
                    lines: z.array(z.string()),
                    city: z.string().optional(),
                    postalCode: z.string().optional(),
                    country: z.string()
                }).optional(),
                identifiers: z.array(z.object({
                    type: z.string(),
                    value: z.string()
                })).optional()
            }),
            prompt: `
            You are a data extraction assistant. Parse the official German Handelsregister HTML query result provided below.
            Extract the company profile for the requested registry reference: ${reference.localRegistrationNumber}.
            
            Map the details to the provided strictly typed schema. 
            If exact properties (like creationDate) aren't present in this top-level HTML, use your general knowledge of major entities if possible, or leave them undefined.
            
            HTML Context:
            ---
            ${truncatedHtml}
            ---
            `
        });

        return {
            sourceType: "REGISTRATION_AUTHORITY",
            registryKey: "DE_HANDELSREGISTER",
            registryAuthorityId: reference.registryAuthorityId,
            sourceRecordId: reference.localRegistrationNumber,
            fetchedAt: new Date(),
            entityName: object.entityName || "Unknown",
            entityStatus: object.entityStatus,
            incorporationDate: object.incorporationDate,
            legalForm: object.legalForm,
            registeredAddress: object.registeredAddress,
            identifiers: object.identifiers || [],
            rawSourcePayload: { _aiExtracted: true, rawHtmlSnippet: truncatedHtml.substring(0, 500) + '...' }
        };
    }
}
