const fs = require('fs');
const file = '/opt/code/coparity/src/actions/kyc-workbench.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    /const customFieldsRaw = await prisma.customFieldDefinition.findMany\(\{\s+where: \{\s+orgId: fiOrgId,\s+isDeleted: false\s+\},\s+orderBy: \{ label: 'asc' \}\s+\}\);/,
    `const customFieldsRaw = await prisma.customFieldDefinition.findMany({
        where: { isDeleted: false },
        orderBy: { label: 'asc' }
    });`
);

fs.writeFileSync(file, code);
