const fs = require('fs');
const content = fs.readFileSync('src/actions/questionnaire.ts', 'utf8');

const newAuthCode = `
import { can, Action, UserWithMemberships } from "@/lib/auth/permissions";

// NEW CORE ENGINE HELPER
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

async function ensureQuestionnaireAccess(id: string, actionType: 'READ' | 'WRITE' | 'DELETE') {
    const q = await prisma.questionnaire.findUnique({
        where: { id },
        select: { fiEngagementId: true, fiOrgId: true }
    });
    if (!q) throw new Error("Questionnaire not found");

    if (q.fiEngagementId) {
        let action: Action = Action.ENG_VIEW_RELEASED_DATA;
        if (actionType === 'WRITE') action = Action.ENG_EDIT_DRAFT_RESPONSES;
        if (actionType === 'DELETE') action = Action.ENG_EDIT_DRAFT_RESPONSES; // We don't have ENG_DELETE_RESPONSES, maybe ENG_UPDATE? 
        // Actually prompt says: "Use ENG_EDIT_DRAFT_RESPONSES or QUESTIONNAIRE_UPDATE for mutation/extraction/analyse"
        await ensureAuthorization(action, { engagementId: q.fiEngagementId });
        return { q };
    } else {
        let action: Action = Action.QUESTIONNAIRE_UPDATE;
        if (actionType === 'READ') action = Action.QUESTIONNAIRE_UPDATE; // Only Supplier Admins view templates
        if (actionType === 'DELETE') action = Action.QUESTIONNAIRE_DELETE;
        await ensureAuthorization(action, { partyId: q.fiOrgId });
        return { q };
    }
}
`;

let newContent = content.replace('import { logActivity } from "./logging";', newAuthCode + '\nimport { logActivity } from "./logging";');

fs.writeFileSync('src/actions/questionnaire.ts', newContent);
