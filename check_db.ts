import prisma from './src/lib/prisma';
async function main() {
    const field = await prisma.masterFieldDefinition.findUnique({ where: { fieldNo: 63 } });
    console.log("Field 63 profileConfig:", JSON.stringify(field?.profileConfig));
}
main().catch(console.error);
