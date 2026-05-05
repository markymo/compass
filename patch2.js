const fs = require('fs');
let content = fs.readFileSync('src/actions/questionnaire.ts', 'utf8');

// Replace standard pattern
content = content.replace(/if \(!\(await canManageQuestionnaire\(id\)\)\) \{/g, 'try { await ensureQuestionnaireAccess(id, "WRITE"); } catch(e) {');
content = content.replace(/if \(!\(await canManageQuestionnaire\(id\)\)\) return \{ success: false, error: "Unauthorized" \};/g, 'try { await ensureQuestionnaireAccess(id, "WRITE"); } catch(e) { return { success: false, error: "Unauthorized" }; }');

// Replace templateId pattern
content = content.replace(/if \(!\(await canManageQuestionnaire\(templateId\)\)\) \{/g, 'try { await ensureQuestionnaireAccess(templateId, "READ"); } catch(e) {');

// Fix createQuestionnaire security block
const createRegex = /\/\/ 2\. Security Check[\s\S]*?\/\/ 3\. Client Engagement Context Check/;
const newCreateCheck = `// 2. Security Check
    try {
        if (engagementId) {
            await ensureAuthorization(Action.ENG_EDIT_DRAFT_RESPONSES, { engagementId });
        } else if (targetOrgId) {
            await ensureAuthorization(Action.QUESTIONNAIRE_CREATE, { partyId: targetOrgId });
        } else {
            return { success: false, error: "Unauthorized: Missing context" };
        }
    } catch (e) {
        return { success: false, error: "Unauthorized" };
    }

    // 3. Client Engagement Context Check`;
content = content.replace(createRegex, newCreateCheck);

fs.writeFileSync('src/actions/questionnaire.ts', content);
