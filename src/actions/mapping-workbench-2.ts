"use server";

import prisma from "@/lib/prisma";
import { isSystemAdmin } from "@/actions/admin";
import { getPathHint } from "@/lib/mapping-workbench/semantic-hints";
import { SOURCE_OPTIONS, SourceOption } from "@/lib/source-display";

// ── Types ──────────────────────────────────────────────────────────────────

export interface Wb2PathMapping {
    mappingId: string;
    targetFieldNo: number;
    targetFieldName: string | null;
    isActive: boolean;
    transformType: string;
    priority: number;
    confidenceDefault: number;
    notes: string | null;
}

export interface Wb2SourcePath {
    path: string;
    meaning: string | null;
    exampleValue: string | null;
    mappings: Wb2PathMapping[];  // all mappings from this path (0, 1 or many)
    isMapped: boolean;          // any active mapping exists
    mappedToFieldNos: number[]; // for graph lookups
}

export interface Wb2SourceData {
    sourceKey: string;          // e.g. "GLEIF" or "CH_RA000585"
    sourceType: string;         // "GLEIF" | "REGISTRATION_AUTHORITY"
    sourceReference: string | null;
    label: string;              // "Companies House (RA000585)"
    paths: Wb2SourcePath[];
    mappedCount: number;
    availableCount: number;
}

export interface Wb2MasterField {
    fieldNo: number;
    fieldName: string;
    appDataType: string;
    isMultiValue: boolean;
    categoryName: string | null;
    description: string | null;
    mappedBySources: string[];
    questionCount: number;
    hasError: boolean;
    /** Live resolved value per sourceKey — only populated when live fetch succeeded */
    liveValues: Record<string, string>;
}

export interface Wb2LiveEntityRef {
    sourceKey: string;
    entityId: string;
    entityName: string | null;
    ok: boolean;
    /** Error message if the fetch failed — shown in UI and logged server-side */
    error: string | null;
}

export interface Wb2Question {
    id: string;
    text: string;
    masterFieldNo: number | null;
    masterFieldName: string | null;
    masterQuestionGroupId: string | null;
    masterQuestionGroupLabel: string | null;
    customFieldDefinitionId: string | null;
    status: string;
    isMapped: boolean;
    sourcedFrom: string[];
}

export interface Wb2Questionnaire {
    id: string;
    name: string;
    questions: Wb2Question[];
    mappedCount: number;
    unmappedCount: number;
}

export interface Wb2PageData {
    sources: Wb2SourceData[];
    masterFields: Wb2MasterField[];
    masterFieldsMappedCount: number;
    masterFieldsUnmappedCount: number;
    questionnaires: Wb2Questionnaire[];
    liveEntityRefs: Wb2LiveEntityRef[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function flattenPaths(obj: any, prefix = "", depth = 0): string[] {
    if (depth > 6 || obj == null || typeof obj !== "object") return [];
    const paths: string[] = [];
    if (Array.isArray(obj)) {
        if (obj.length > 0) {
            paths.push(...flattenPaths(obj[0], `${prefix}[0]`, depth + 1).map(p => p));
        }
    } else {
        for (const [k, v] of Object.entries(obj)) {
            const fullPath = prefix ? `${prefix}.${k}` : k;
            paths.push(fullPath);
            if (typeof v === "object" && v !== null) {
                paths.push(...flattenPaths(v, fullPath, depth + 1));
            }
        }
    }
    return paths;
}

function resolveValue(obj: any, path: string): string | null {
    try {
        const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".");
        let cur: any = obj;
        for (const p of parts) {
            if (cur == null) return null;
            cur = cur[p];
        }
        if (cur == null) return null;
        if (typeof cur === "object") return JSON.stringify(cur).slice(0, 60);
        return String(cur).slice(0, 60);
    } catch { return null; }
}

// ── Demo entity IDs for live example data ──────────────────────────────────

const DEMO_ENTITIES = {
    // GLEIF LEI for Diamond Transmission Partners Hornsea Two Limited
    // (same legal entity as CH 14059418 — they align)
    GLEIF:       { lei: "213800SN8QHYGA7QUF79",  internalKey: "GLEIF" },
    CH_RA000585: { companyNo: "14059418",          internalKey: "REGISTRATION_AUTHORITY:RA000585" },
    FR_RA000192: { siren: "542051180",             internalKey: "REGISTRATION_AUTHORITY:RA000192" },
};

/** Fetch live entity data for the three demo entities. Returns Map<internalKey, payload>. */
async function fetchLivePayloads(): Promise<{ payloads: Map<string, any>; refs: Wb2LiveEntityRef[] }> {
    const payloads = new Map<string, any>();
    const refs: Wb2LiveEntityRef[] = [];

    const [gleif, ch, fr] = await Promise.allSettled([
        // GLEIF — public API, no key needed
        fetch(`https://api.gleif.org/api/v1/lei-records?filter[lei]=${DEMO_ENTITIES.GLEIF.lei}`,
            { headers: { Accept: "application/vnd.api+json" }, cache: "no-store", signal: AbortSignal.timeout(30000) })
            .then(r => r.json())
            .then(j => j.data?.[0]?.attributes ?? null),

        // Companies House — return RAW API profile so paths like
        // company_name, company_status, date_of_creation resolve correctly.
        // (DB source mappings for CH use raw CH API path names, not canonical names)
        (async () => {
            const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
            if (!apiKey) return null;
            const auth = `Basic ${Buffer.from(apiKey + ":").toString("base64")}`;
            const profile = await fetch(
                `https://api.company-information.service.gov.uk/company/${DEMO_ENTITIES.CH_RA000585.companyNo}`,
                { headers: { Authorization: auth }, cache: "no-store", signal: AbortSignal.timeout(30000) }
            ).then(r => r.json());
            // Return the raw profile — CH source mappings reference raw field names
            return profile ?? null;
        })(),

        // French Registry — public API
        fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${DEMO_ENTITIES.FR_RA000192.siren}&page=1&per_page=1`,
            { headers: { Accept: "application/json", "User-Agent": "CoParity-Admin/1.0" }, cache: "no-store", signal: AbortSignal.timeout(30000) })
            .then(r => r.json())
            .then(d => {
                const c = d.results?.[0];
                if (!c || c.siren !== DEMO_ENTITIES.FR_RA000192.siren) return null;
                const siege = c.siege ?? {};
                return {
                    entityName: c.nom_raison_sociale || c.nom_complet || null,
                    entityStatus: c.etat_administratif ?? null,
                    incorporationDate: c.date_creation ?? null,
                    registeredAddress: {
                        lines: [siege.adresse].filter(Boolean),
                        city: siege.libelle_commune ?? null,
                        country: "FR",
                        postalCode: siege.code_postal ?? null,
                    },
                };
            }),
    ]);

    // GLEIF
    const gleifPayload = gleif.status === "fulfilled" ? gleif.value : null;
    const gleifError   = gleif.status === "rejected"  ? String(gleif.reason) : null;
    if (gleifError) console.error("[LivePayloads] GLEIF fetch failed:", gleifError);
    payloads.set(DEMO_ENTITIES.GLEIF.internalKey, gleifPayload);
    refs.push({
        sourceKey: "GLEIF",
        entityId: DEMO_ENTITIES.GLEIF.lei,
        entityName: (gleifPayload as any)?.entity?.legalName?.name ?? null,
        ok: !!gleifPayload,
        error: gleifError,
    });

    // CH — guard against CH returning an error JSON (e.g. 401 {error:"..."})
    const chRaw    = ch.status === "fulfilled" ? ch.value : null;
    const chError  = ch.status === "rejected"  ? String(ch.reason) : null;
    // A valid CH profile always has company_name; an error response does not
    const chPayload = (chRaw && typeof chRaw === "object" && "company_name" in chRaw) ? chRaw : null;
    if (chError)              console.error("[LivePayloads] CH fetch failed:", chError);
    if (chRaw && !chPayload)  console.error("[LivePayloads] CH returned unexpected response:", JSON.stringify(chRaw).slice(0, 200));
    payloads.set(DEMO_ENTITIES.CH_RA000585.internalKey, chPayload);
    refs.push({
        sourceKey: "CH_RA000585",
        entityId: DEMO_ENTITIES.CH_RA000585.companyNo,
        entityName: (chPayload as any)?.company_name ?? null,
        ok: !!chPayload,
        error: chError ?? (chRaw && !chPayload ? "Unexpected API response (no company_name)" : null),
    });

    // FR — compare siren as string to guard against type mismatch
    const frRaw    = fr.status === "fulfilled" ? fr.value : null;
    const frError  = fr.status === "rejected"  ? String(fr.reason) : null;
    if (frError) console.error("[LivePayloads] FR fetch failed:", frError);
    const frPayload = frRaw ?? null; // already validated inside the fetch chain
    payloads.set(DEMO_ENTITIES.FR_RA000192.internalKey, frPayload);
    refs.push({
        sourceKey: "FR_RA000192",
        entityId: DEMO_ENTITIES.FR_RA000192.siren,
        entityName: (frPayload as any)?.entityName ?? null,
        ok: !!frPayload,
        error: frError,
    });

    return { payloads, refs };
}

// ── Main action ────────────────────────────────────────────────────────────

export async function getMappingWorkbench2Data(): Promise<Wb2PageData> {
    const isAdmin = await isSystemAdmin();
    if (!isAdmin) throw new Error("Unauthorized");

    const [allMappings, fieldDefs, samplePayloads, questionnaires, groups, liveData] = await Promise.all([
        prisma.sourceFieldMapping.findMany({
            orderBy: [{ sourceType: "asc" }, { priority: "asc" }],
        }),
        prisma.masterFieldDefinition.findMany({
            where: { isActive: true },
            include: { masterDataCategory: true },
            orderBy: [{ order: "asc" }, { fieldNo: "asc" }],
        }),
        prisma.sourceSamplePayload.findMany({
            where: { isDefault: true },
            select: { sourceType: true, payload: true },
        }),
        prisma.questionnaire.findMany({
            where: { isDeleted: false, fiEngagementId: null },

            include: {
                questions: {
                    orderBy: { order: "asc" },
                    select: {
                        id: true,
                        text: true,
                        masterFieldNo: true,
                        masterQuestionGroupId: true,
                        customFieldDefinitionId: true,
                        status: true,
                    },
                },
            },
            orderBy: { name: "asc" },
        }),
        prisma.masterFieldGroup.findMany({
            where: { isActive: true },
            select: { key: true, label: true },
        }),
        fetchLivePayloads(),
    ]);

    // ── Index maps ──────────────────────────────────────────────────────
    const fieldByNo = new Map(fieldDefs.map((f: any) => [f.fieldNo, f]));
    const groupByKey = new Map(groups.map((g: any) => [g.key, g]));

    // mappingsBySource: sourceKey → mapping[]
    const mappingsBySource = new Map<string, typeof allMappings>();
    for (const m of allMappings) {
        const key = m.sourceReference
            ? `${m.sourceType}:${m.sourceReference}`
            : m.sourceType;
        const arr = mappingsBySource.get(key) ?? [];
        arr.push(m);
        mappingsBySource.set(key, arr);
    }

    // sampleBySourceType: "GLEIF" | "REGISTRATION_AUTHORITY" → payload JSON
    const sampleBySourceType = new Map<string, any>();
    for (const sp of samplePayloads) {
        // Store by sourceType — all RA sources share the same super-schema sample
        sampleBySourceType.set(sp.sourceType as string, (sp as any).payload);
    }

    // fieldNo → which sourceKeys map to it (active)
    const fieldSourceMap = new Map<number, Set<string>>();
    for (const m of allMappings) {
        if (!m.isActive) continue;
        const key = m.sourceReference ? `${m.sourceType}:${m.sourceReference}` : m.sourceType;
        const s = fieldSourceMap.get(m.targetFieldNo) ?? new Set();
        s.add(key);
        fieldSourceMap.set(m.targetFieldNo, s);
    }

    // ── Build source data ───────────────────────────────────────────────
    const sources: Wb2SourceData[] = SOURCE_OPTIONS.map((opt: SourceOption) => {
        const sourceKey = opt.value;
        // Map SOURCE_OPTIONS key → internal lookup key
        const internalKey = opt.sourceReference
            ? `${opt.sourceType}:${opt.sourceReference}`
            : opt.sourceType;

        const sourceMappings = mappingsBySource.get(internalKey) ?? [];

        // ── Two separate payloads for two separate purposes ──────────────
        // 1. Path discovery: always use the STORED sample (stable schema,
        //    comprehensive coverage of all possible paths for this source type)
        const storedSample = sampleBySourceType.get(opt.sourceType) ?? null;

        // 2. Example values: prefer LIVE entity (fresh real data),
        //    fall back to stored sample so something always shows
        const livePayload   = liveData.payloads.get(internalKey) ?? null;
        const examplePayload = livePayload ?? storedSample;

        // All paths: from STORED sample + from existing mappings (consistent discovery)
        const samplePaths  = storedSample ? flattenPaths(storedSample) : [];
        const mappingPaths = sourceMappings.map((m: any) => m.sourcePath);
        const allPaths     = [...new Set([...mappingPaths, ...samplePaths])].sort();

        // Build path rows — collect ALL mappings per path
        const paths: Wb2SourcePath[] = allPaths.map(path => {
            const pathMappings = sourceMappings.filter((m: any) => m.sourcePath === path);
            // meaning: notes from first mapping, or semantic hint, or null
            const firstMapping = pathMappings[0] as any;
            const meaning = firstMapping?.notes?.trim()
                ? firstMapping.notes.trim()
                : getPathHint(opt.sourceType, path);

            const mappings: Wb2PathMapping[] = pathMappings.map((m: any) => {
                const targetField = fieldByNo.get(m.targetFieldNo) as any;
                return {
                    mappingId: m.id,
                    targetFieldNo: m.targetFieldNo,
                    targetFieldName: targetField?.fieldName ?? null,
                    isActive: m.isActive,
                    transformType: m.transformType,
                    priority: m.priority,
                    confidenceDefault: m.confidenceDefault,
                    notes: m.notes ?? null,
                };
            });

            const activeFieldNos = mappings.filter(m => m.isActive).map(m => m.targetFieldNo);

            return {
                path,
                meaning: meaning || null,
                // Resolve from live entity first, fall back to stored sample
                exampleValue: examplePayload ? resolveValue(examplePayload, path) : null,
                mappings,
                isMapped: activeFieldNos.length > 0,
                mappedToFieldNos: activeFieldNos,
            };
        });

        const mappedCount = paths.filter(p => p.isMapped).length;

        return {
            sourceKey,
            sourceType: opt.sourceType,
            sourceReference: opt.sourceReference,
            label: opt.label,
            paths,
            mappedCount,
            availableCount: allPaths.length,
        };
    });


    // ── Build master field data ─────────────────────────────────────────

    // fieldNo → question count (across all questionnaires)
    const fieldQuestionCount = new Map<number, number>();
    for (const qnaire of questionnaires) {
        for (const q of qnaire.questions) {
            if (q.masterFieldNo) {
                fieldQuestionCount.set(q.masterFieldNo, (fieldQuestionCount.get(q.masterFieldNo) ?? 0) + 1);
            }
        }
    }

    // fieldNo → live resolved value per sourceKey (first active mapping wins)
    const fieldLiveValues = new Map<number, Record<string, string>>();
    for (const m of allMappings) {
        if (!m.isActive) continue;
        const internalKey = m.sourceReference ? `${m.sourceType}:${m.sourceReference}` : m.sourceType;
        const livePayload = liveData.payloads.get(internalKey);
        if (!livePayload) continue;
        const val = resolveValue(livePayload, m.sourcePath);
        if (!val) continue;
        // Find the sourceKey for this internalKey
        const srcOpt = SOURCE_OPTIONS.find((o: SourceOption) =>
            (o.sourceReference ? `${o.sourceType}:${o.sourceReference}` : o.sourceType) === internalKey
        );
        const sourceKey = srcOpt?.value ?? internalKey;
        const existing = fieldLiveValues.get(m.targetFieldNo) ?? {};
        if (!existing[sourceKey]) { existing[sourceKey] = val; }
        fieldLiveValues.set(m.targetFieldNo, existing);
    }

    const masterFields: Wb2MasterField[] = fieldDefs.map((f: any) => {
        const sources = fieldSourceMap.get(f.fieldNo);
        const mappedBySources = sources ? [...sources] : [];
        const hasError = f.isMultiValue && (fieldQuestionCount.get(f.fieldNo) ?? 0) > 0;

        return {
            fieldNo: f.fieldNo,
            fieldName: f.fieldName,
            appDataType: f.appDataType,
            isMultiValue: f.isMultiValue,
            categoryName: f.masterDataCategory?.displayName ?? null,
            description: f.description ?? null,
            mappedBySources,
            questionCount: fieldQuestionCount.get(f.fieldNo) ?? 0,
            hasError,
            liveValues: fieldLiveValues.get(f.fieldNo) ?? {},
        };
    });

    const masterFieldsMappedCount = masterFields.filter(f => f.mappedBySources.length > 0).length;
    const masterFieldsUnmappedCount = masterFields.length - masterFieldsMappedCount;

    // ── Build questionnaire data ────────────────────────────────────────

    // For each question, resolve upstream sources via its masterFieldNo
    const wb2Questionnaires: Wb2Questionnaire[] = questionnaires.map((qnaire: any) => {
        const questions: Wb2Question[] = qnaire.questions.map((q: any) => {
            const masterField = q.masterFieldNo ? fieldByNo.get(q.masterFieldNo) : null;
            const masterGroup = q.masterQuestionGroupId ? (groupByKey.get(q.masterQuestionGroupId) as any) : null;
            const isMapped = !!(q.masterFieldNo || q.masterQuestionGroupId || q.customFieldDefinitionId);

            // Upstream sources: from field's mappedBySources
            const sourcedFrom = q.masterFieldNo
                ? [...(fieldSourceMap.get(q.masterFieldNo) ?? [])]
                : [];

            return {
                id: q.id,
                text: q.text,
                masterFieldNo: q.masterFieldNo ?? null,
                masterFieldName: (masterField as any)?.fieldName ?? null,
                masterQuestionGroupId: q.masterQuestionGroupId ?? null,
                masterQuestionGroupLabel: masterGroup?.label ?? null,
                customFieldDefinitionId: q.customFieldDefinitionId ?? null,
                status: q.status ?? "DRAFT",
                isMapped,
                sourcedFrom,
            };
        });

        const mappedCount = questions.filter(q => q.isMapped).length;
        const unmappedCount = questions.length - mappedCount;

        return {
            id: qnaire.id,
            name: qnaire.name,
            questions,
            mappedCount,
            unmappedCount,
        };
    });

    return {
        sources,
        masterFields,
        masterFieldsMappedCount,
        masterFieldsUnmappedCount,
        questionnaires: wb2Questionnaires,
        liveEntityRefs: liveData.refs,

    };
}
