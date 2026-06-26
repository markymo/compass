import prisma from './src/lib/prisma';

async function main() {
    await prisma.masterFieldDefinition.update({
        where: { fieldNo: 63 },
        data: {
            profileConfig: {
                allowedPartyTypes: ["INDIVIDUAL"],
                allowedPartySubTypes: ["PERSON"],
                storageModes: ["EMBEDDED", "REFERENCE"],
                displayMask: ["forenames", "surname"],
                editMask: ["forenames", "surname"]
            }
        }
    });
    console.log("Updated Field 63");
}

main().catch(e => { console.error(e); process.exit(1); });
