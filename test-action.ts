import { getFullMasterData } from "./src/actions/client-le";
import prisma from "./src/lib/prisma";

async function main() {
  const le = await prisma.clientLE.findFirst();
  const data = await getFullMasterData(le.id) as any;
  console.log(JSON.stringify(data.data[148], null, 2));
}

main().then(() => process.exit(0)).catch(console.error);
