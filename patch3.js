const fs = require('fs');
const file = '/opt/code/coparity/src/actions/client-le.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    /customDefinitions = await prisma.customFieldDefinition.findMany\(\{\s+where: \{\s+OR: \[\s+\{ orgId: \{ in: Array.from\(targetOrgIds\) \} \},\s+\{ id: \{ in: Array.from\(targetDefIds\) \} \}\s+\]\s+\},\s+orderBy: \{ label: 'asc' \}\s+\}\);/,
    `customDefinitions = await prisma.customFieldDefinition.findMany({
            where: {
                OR: [
                    { orgId: { in: Array.from(targetOrgIds) } },
                    { id: { in: Array.from(targetDefIds) } }
                ],
                isDeleted: false
            },
            orderBy: { label: 'asc' }
        });`
);

fs.writeFileSync(file, code);
