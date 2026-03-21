import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function simulateUpdate() {
    const userId = "user_36i0omTdR3K7bdswkf3fn2MHaQE"; // Mark's ID from DB
    console.log("Simulating update for user:", userId);

    const user = await prisma.user.findUnique({
        where: { id: userId }
    });

    if (!user) {
        console.error("User not found!");
        return;
    }

    console.log("Current Prefs:", (user as any).preferences);

    const data = {
        preferences: { whimsyMode: true }
    };

    const updatedUser = await (prisma.user as any).update({
        where: { id: userId },
        data: {
            preferences: { ...((user as any).preferences || {}), ...data.preferences }
        }
    });

    console.log("Update result preferences:", updatedUser.preferences);

    // Verify again
    const finalUser = await prisma.user.findUnique({
        where: { id: userId }
    });
    console.log("Final check preferences:", (finalUser as any).preferences);
}

simulateUpdate()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
