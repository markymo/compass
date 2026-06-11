"use server";

import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

export interface AIDetectionResult {
    isLikelyAddress: boolean;
    score: number;
    confidence: "LOW" | "MEDIUM" | "HIGH";
    detectedFields: {
        addressLines?: string[];
        locality?: string;
        region?: string;
        postalCode?: string;
        countryCode?: string;
        premiseIdentifier?: string;
        subPremise?: string;
    };
    reasons: string[];
    method: "AI";
}

export async function detectAddressWithAI(params: {
    sourceType?: string | null;
    sourceReference?: string | null;
    payloadSubtype?: string | null;
    nodePath: string;
    nodeValue: any;
    nearbyChildKeys: string[];
}): Promise<{ success: boolean; result?: AIDetectionResult; error?: string }> {
    try {
        const key = process.env.OPENAI_API_KEY;
        if (!key) {
            return {
                success: false,
                error: "OpenAI API key not configured"
            };
        }

        const openai = createOpenAI({ apiKey: key });

        const systemInstructions = `You are a legal registry data parser.
Analyze the provided JSON object to decide if it represents a physical, postal, legal, or business address structure.
Map its keys to the standard target Address schema:
- addressLines (array of lines or streets)
- locality (city/town)
- region (state/province/county/department)
- postalCode (zip/postcode)
- countryCode (ISO 2-letter country code or country name)
- premiseIdentifier (house number, building name)
- subPremise (flat, apartment, suite)`;

        const userPrompt = `
Context details:
- Source Type: ${params.sourceType || "Unknown"}
- Source Reference: ${params.sourceReference || "Unknown"}
- Payload Subtype: ${params.payloadSubtype || "Unknown"}
- Node Path: ${params.nodePath}
- Node Keys: ${JSON.stringify(params.nearbyChildKeys)}
- Node JSON Value: ${JSON.stringify(params.nodeValue, null, 2)}

Identify if this represents an address, and map the corresponding fields.
`;

        const { object } = await generateObject({
            model: openai('gpt-4o-mini'),
            schema: z.object({
                isLikelyAddress: z.boolean().describe("True if this object represents a postal/legal/business address"),
                confidence: z.enum(["LOW", "MEDIUM", "HIGH"]).describe("Confidence level"),
                detectedFields: z.object({
                    addressLines: z.array(z.string()).optional().describe("Address lines, street address, thoroughfare"),
                    locality: z.string().optional().describe("City, town, commune, locality"),
                    region: z.string().optional().describe("State, province, county, region, department"),
                    postalCode: z.string().optional().describe("Postal code, zip code, postcode"),
                    countryCode: z.string().optional().describe("ISO country code or country name"),
                    premiseIdentifier: z.string().optional().describe("House number, building name, premise"),
                    subPremise: z.string().optional().describe("Apartment, suite, unit, flat, sub-premise")
                }),
                reasons: z.array(z.string()).describe("Detailed reasons for classification and mapping choices")
            }),
            system: systemInstructions,
            prompt: userPrompt,
            temperature: 0.1
        });

        const score = object.confidence === "HIGH" ? 12 : object.confidence === "MEDIUM" ? 6 : 2;

        return {
            success: true,
            result: {
                isLikelyAddress: object.isLikelyAddress,
                score,
                confidence: object.confidence,
                detectedFields: object.detectedFields,
                reasons: object.reasons,
                method: "AI"
            }
        };
    } catch (e: any) {
        console.error("[detectAddressWithAI Error]", e);
        return {
            success: false,
            error: e.message || "Failed to perform AI address detection"
        };
    }
}
