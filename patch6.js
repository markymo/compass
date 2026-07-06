const fs = require('fs');

// Patch 1: field-detail-panel.tsx
const panelFile = '/opt/code/coparity/src/components/client/inspection/field-detail-panel.tsx';
let panelCode = fs.readFileSync(panelFile, 'utf8');
panelCode = panelCode.replace(
    /if \(\!manualValue\) \{\s+toast\.error\("A value is required"\);\s+return;\s+\}/,
    `if (!manualValue && !customFieldId) {
            toast.error("A value is required");
            return;
        }`
);
fs.writeFileSync(panelFile, panelCode);

// Patch 2: kyc-manual-update.ts
const actionFile = '/opt/code/coparity/src/actions/kyc-manual-update.ts';
let actionCode = fs.readFileSync(actionFile, 'utf8');
const actionAnchorRegex = /const newData = \{\s+\.\.\.currentData,\s+\[fieldKey\]: \{\s+value: value,\s+source: "USER_INPUT",\s+timestamp: new Date\(\)\.toISOString\(\),\s+updatedBy: userId,\s+reason: reason\s+\}\s+\};/;
const replacementCode = `const newData = { ...currentData };
        if (value === "" || value === null || value === undefined) {
            delete newData[fieldKey];
        } else {
            newData[fieldKey] = {
                value: value,
                source: "USER_INPUT",
                timestamp: new Date().toISOString(),
                updatedBy: userId,
                reason: reason
            };
        }`;
actionCode = actionCode.replace(actionAnchorRegex, replacementCode);
fs.writeFileSync(actionFile, actionCode);
