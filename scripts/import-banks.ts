
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
    const filePath = path.join(process.cwd(), 'docs/data/Bank Target List Feb 26.xlsx');
    console.log(`Reading file: ${filePath}`);

    if (!fs.existsSync(filePath)) {
        console.error('File not found!');
        process.exit(1);
    }

    const workbook = XLSX.readFile(filePath);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Header is row 0. Data starts row 1 (index 1 is row 2)
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log(`Processing ${rows.length} rows...`);

    let stats = {
        uk: { updated: 0, created: 0, skipped: 0 },
        eu: { updated: 0, created: 0, skipped: 0 }
    };

    // --- PASS 1: UK TABLE (Indices 1-6 / Cols B-G) ---
    console.log('\n--- PASS 1: UK LEAGUE TABLE ---');
    let lastRankUK = 0;
    for (let i = 1; i < rows.length; i++) {
        const row: any = rows[i];
        if (!row) continue;

        // UK Cols: Name(1), Volume(2), Count(3), Share(4)
        // Indices in array: 0=Rank, 1=Name, 2=Vol, 3=Count, 4=Share... 
        // Wait, sheet_to_json with header:1 returns 0-indexed array of cells.
        // Let's verify based on previous preview.
        // Preview: Row 15: ["=","BBVA",1800.91,13,0.024...]
        // Index 1 = Name ("BBVA")
        // Index 2 = Volume
        // Index 3 = Count
        // Index 4 = Share

        const name = row[1];
        if (!name || typeof name !== 'string') continue;

        let rank = row[0];
        if (rank === '=') {
            rank = lastRankUK;
        } else if (typeof rank === 'number') {
            lastRankUK = rank;
        }

        const volume = row[2];
        const count = row[3];
        const share = row[4];

        await upsertBank(name, "uk", { rank, volume, count, share }, stats.uk);
    }

    // --- PASS 2: EUROPEAN TABLE (Indices 9-14 / Cols J-O) ---
    console.log('\n--- PASS 2: EUROPEAN LEAGUE TABLE ---');
    let lastRankEU = 0;
    for (let i = 1; i < rows.length; i++) {
        const row: any = rows[i];
        if (!row) continue;

        // Preview: ..., 13,"Mitsubishi UFJ Financial Group",4640.15,42,...
        // Let's count indices.
        // 0=RankUK, 1=NameUK, 2=VolUK, 3=CntUK, 4=ShareUK, 5, 6, 7 (spacers?)
        // Let's re-check row 15 from previous log:
        // [ "=", "BBVA", 1800.91, 13, 0.024, 252, 0.47, null, 13, "Mitsubishi...", 4640.15, 42... ]
        // 0="=", 1="BBVA", 2=1800, 3=13, 4=0.024, 5=252, 6=0.47, 7=null
        // 8=13 (EU Rank), 9="Mitsubishi..." (EU Name)
        // So EU Name index is 9.
        // EU Vol = 10
        // EU Count = 11
        // EU Share = 12

        const name = row[9];
        // If row is short, might not have EU data
        if (!name || typeof name !== 'string') continue;

        let rank = row[8];
        if (rank === '=') {
            rank = lastRankEU;
        } else if (typeof rank === 'number') {
            lastRankEU = rank;
        }

        const volume = row[10];
        const count = row[11];
        const share = row[12];

        await upsertBank(name, "eu", { rank, volume, count, share }, stats.eu);
    }

    console.log('\n--- IMPORT COMPLETE ---');
    console.log('Stats:', JSON.stringify(stats, null, 2));
}

async function upsertBank(rawName: string, region: "uk" | "eu", data: any, statCounter: any) {
    const cleanName = rawName.trim();

    // Find existing
    // We use findFirst relative match to be safe
    const existing = await prisma.organization.findFirst({
        where: {
            name: { equals: cleanName, mode: 'insensitive' },
            types: { has: 'FI' } // Only match FIs? Or any Org? Let's restrict to FI or assume we make it FI.
        }
    });

    if (existing) {
        // Update Metadata
        const currentMeta: any = (existing as any).metadata || {};
        const leagueTable = currentMeta.leagueTable || {};

        leagueTable[region] = data;

        await prisma.organization.update({
            where: { id: existing.id },
            data: {
                metadata: { ...currentMeta, leagueTable } as any
            }
        });
        statCounter.updated++;
        process.stdout.write('.'); // Progress dot
    } else {
        // Create New
        const leagueTable: any = {};
        leagueTable[region] = data;

        await prisma.organization.create({
            data: {
                name: cleanName,
                types: ["FI"], // Assume Financial Institution
                status: "ACTIVE",
                metadata: { leagueTable } as any
            }
        });
        statCounter.created++;
        process.stdout.write('+'); // Plus for create
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

export { };
