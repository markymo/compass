import { describe, it, expect } from "vitest";
import prisma from "@/lib/prisma";

describe("Database Mapping Inspection", () => {
    it("1. Inspect exact mapping 867aa28c-999c-436f-b430-b9e541c223b2", async () => {
        const row = await prisma.sourceFieldMapping.findUnique({
            where: { id: "867aa28c-999c-436f-b430-b9e541c223b2" }
        });
        console.log("EXACT_ROW_867aa28c:", JSON.stringify(row, null, 2));
    });

    it("2. Inspect all active GLEIF mappings", async () => {
        const mappings = await prisma.sourceFieldMapping.findMany({
            where: { sourceType: "GLEIF" },
            orderBy: [{ targetFieldNo: "asc" }]
        });
        console.log(`TOTAL_GLEIF_MAPPINGS: ${mappings.length}`);
        for (const m of mappings) {
            if (m.sourcePath.includes("gleifL2") || m.targetFieldNo === 40 || m.targetFieldNo === 38 || m.targetFieldNo === 41 || m.targetFieldNo === 39) {
                console.log(`GLEIF_L2_ROW: id=${m.id} fieldNo=${m.targetFieldNo} path="${m.sourcePath}" payloadSubtype=${m.payloadSubtype} mappingScope=${m.mappingScope} transform=${m.transformType} active=${m.isActive} priority=${m.priority} createdAt=${m.createdAt?.toISOString()} updatedAt=${m.updatedAt?.toISOString()}`);
            }
        }
    });
});
