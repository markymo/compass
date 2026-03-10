const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Fixing missing question mappings for instance b3f58642-c1ce-4232-8075-6e0a9665f7cb based on template 27e2594a-4d53-44b1-80a9-bcf08ddb8100...");
    
    const template = await prisma.questionnaire.findUnique({
        where: { id: '27e2594a-4d53-44b1-80a9-bcf08ddb8100' },
        include: { questions: true }
    });
    
    if (!template) {
        console.log("Template questionnaire not found.");
        return;
    }
    
    const instance = await prisma.questionnaire.findUnique({
        where: { id: 'b3f58642-c1ce-4232-8075-6e0a9665f7cb' },
        include: { questions: true }
    });
    
    if (!instance) {
        console.log("Instance questionnaire not found.");
        return;
    }
    
    let updatedCount = 0;
    
    for (const instQ of instance.questions) {
        // Find matching question in template by text
        const templateQ = template.questions.find(tq => tq.text === instQ.text);
        
        if (templateQ) {
            let needsUpdate = false;
            let data = {};
            
            if (instQ.masterFieldNo !== templateQ.masterFieldNo) {
                data.masterFieldNo = templateQ.masterFieldNo;
                needsUpdate = true;
            }
            if (instQ.masterQuestionGroupId !== templateQ.masterQuestionGroupId) {
                data.masterQuestionGroupId = templateQ.masterQuestionGroupId;
                needsUpdate = true;
            }
            if (instQ.customFieldDefinitionId !== templateQ.customFieldDefinitionId) {
                data.customFieldDefinitionId = templateQ.customFieldDefinitionId;
                needsUpdate = true;
            }
            
            if (needsUpdate) {
                console.log(`Updating Question "${instQ.text.substring(0, 30)}..." - Setting masterFieldNo: ${data.masterFieldNo}, Group: ${data.masterQuestionGroupId}`);
                await prisma.question.update({
                    where: { id: instQ.id },
                    data: data
                });
                updatedCount++;
            }
        }
    }
    
    console.log(`\nSuccessfully updated ${updatedCount} questions in the instance.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
