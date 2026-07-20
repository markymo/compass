import { getFullMasterData } from "./src/actions/client-le";
import prisma from "./src/lib/prisma";

async function main() {
  const le = await prisma.clientLE.findFirst();
  const data = await getFullMasterData(le.id) as any;
  const f148 = data.data[148];
  console.log(JSON.stringify(f148, null, 2));
}

main().then(() => process.exit(0)).catch(console.error);
