const fs = require('fs');
let content = fs.readFileSync('src/actions/fi.ts', 'utf8');

// 1. Add missing imports and ensureAuthorization helper
const authCode = `
import { can, Action, UserWithMemberships } from "@/lib/auth/permissions";

// Helper for Auth
async function ensureAuthorization(action: Action, context: { partyId?: string, clientLEId?: string, engagementId?: string }) {
    const identity = await getIdentity();
    if (!identity?.userId) throw new Error("Unauthorized: No User");

    const memberships = await prisma.membership.findMany({
        where: { userId: identity.userId },
        select: { organizationId: true, clientLEId: true, fiEngagementId: true, role: true }
    });

    const user: UserWithMemberships = { id: identity.userId, memberships };
    const allowed = await can(user, action, context, prisma);
    
    if (!allowed) throw new Error(\`Unauthorized: Cannot perform \${action}\`);
    return { userId: identity.userId };
}
`;

content = content.replace('import { revalidatePath } from "next/cache";', 'import { revalidatePath } from "next/cache";\n' + authCode);


// 2. Harden getFIEngagements
const getFIEngagementsRegex = /export async function getFIEngagements\(fiOrgId\?: string\): Promise<ApplicationEngagement\[\]> \{[\s\S]*?(?=const engagements = await prisma\.fIEngagement\.findMany)/;
const getFIEngagementsNew = `export async function getFIEngagements(fiOrgId?: string): Promise<ApplicationEngagement[]> {
    const identity = await getIdentity();
    if (!identity?.userId) return [];
    const { userId } = identity;

    const memberships = await prisma.membership.findMany({
        where: { userId, fiEngagementId: { not: null } },
        select: { fiEngagementId: true }
    });
    const myEngagementIds = memberships.map((m: any) => m.fiEngagementId).filter(Boolean) as string[];

    if (myEngagementIds.length === 0) return [];

    `;
content = content.replace(getFIEngagementsRegex, getFIEngagementsNew);

// Add 'id: { in: myEngagementIds }' inside findMany where
content = content.replace(
    /(const engagements = await prisma\.fIEngagement\.findMany\(\{\s*where: \{\s*)fiOrgId: \{ in: targetFiOrgIds \},/g, 
    '$1id: { in: myEngagementIds },\n            ...(fiOrgId ? { fiOrgId } : {}),'
);


// 3. Harden getFIEngagementById
const getFIEngagementByIdRegex = /export async function getFIEngagementById\(id: string\): Promise<ApplicationEngagement \| null> \{[\s\S]*?(?=const engagement = await prisma\.fIEngagement\.findFirst)/;
const getFIEngagementByIdNew = `export async function getFIEngagementById(id: string): Promise<ApplicationEngagement | null> {
    try {
        await ensureAuthorization(Action.ENG_VIEW_RELEASED_DATA, { engagementId: id });
    } catch (e) {
        return null;
    }

    const whereClause: any = { id };
    `;
content = content.replace(getFIEngagementByIdRegex, getFIEngagementByIdNew);


// 4. Harden assignQuestionnaireToEngagement
const assignQuestionnaireRegex = /export async function assignQuestionnaireToEngagement\(engagementId: string, templateId: string\) \{[\s\S]*?(?=\/\/ 1\. Fetch Template and its Questions)/;
const assignQuestionnaireNew = `export async function assignQuestionnaireToEngagement(engagementId: string, templateId: string) {
    try {
        await ensureAuthorization(Action.ENG_UPDATE, { engagementId });
    } catch (e) {
        return { success: false, error: "Unauthorized" };
    }

    const engagement = await prisma.fIEngagement.findUnique({
        where: { id: engagementId },
        select: { fiOrgId: true }
    });
    if (!engagement) return { success: false, error: "Engagement not found" };

    `;
content = content.replace(assignQuestionnaireRegex, assignQuestionnaireNew);


// 5. Harden deleteEngagement
const deleteEngagementRegex = /export async function deleteEngagement\(id: string\) \{[\s\S]*?(?=try \{)/;
const deleteEngagementNew = `export async function deleteEngagement(id: string) {
    try {
        await ensureAuthorization(Action.ENG_DELETE, { engagementId: id });
    } catch (e) {
        return { success: false, error: "Unauthorized" };
    }

    `;
content = content.replace(deleteEngagementRegex, deleteEngagementNew);


// 6. Harden archiveEngagement
const archiveEngagementRegex = /export async function archiveEngagement\(id: string\) \{[\s\S]*?(?=try \{)/;
const archiveEngagementNew = `export async function archiveEngagement(id: string) {
    try {
        await ensureAuthorization(Action.ENG_UPDATE, { engagementId: id });
    } catch (e) {
        return { success: false, error: "Unauthorized" };
    }

    `;
content = content.replace(archiveEngagementRegex, archiveEngagementNew);


// 7. Harden getFIDashboardStats
const getFIDashboardStatsRegex = /const \[questionnaires, engagements, queries\] = await Promise\.all\(\[\s*prisma\.questionnaire\.count\(\{ where: \{ fiOrgId: \{ in: targetFiOrgIds \}, isDeleted: false \} \}\),\s*prisma\.fIEngagement\.count\(\{ where: \{ fiOrgId: \{ in: targetFiOrgIds \}, isDeleted: false, status: \{ not: "ARCHIVED" \} \} \}\),/g;
const getFIDashboardStatsNew = `
    const explicitMemberships = await prisma.membership.findMany({
        where: { userId, fiEngagementId: { not: null } },
        select: { fiEngagementId: true }
    });
    const explicitEngagementIds = explicitMemberships.map((m: any) => m.fiEngagementId).filter(Boolean) as string[];

    const [questionnaires, engagements, queries] = await Promise.all([
        prisma.questionnaire.count({ where: { fiOrgId: { in: targetFiOrgIds }, isDeleted: false } }),
        prisma.fIEngagement.count({ where: { id: { in: explicitEngagementIds }, isDeleted: false, status: { not: "ARCHIVED" } } }),`;
content = content.replace(getFIDashboardStatsRegex, getFIDashboardStatsNew);


fs.writeFileSync('src/actions/fi.ts', content);
