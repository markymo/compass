const fs = require('fs');
const file = 'src/components/client/inspection/field-detail-panel.tsx';
let content = fs.readFileSync(file, 'utf8');

const occurrences = [
  { from: 'legalEntityId: string;', to: 'clientLEId: string;' },
  { from: '{ open, onOpenChange, legalEntityId, fieldNo', to: '{ open, onOpenChange, clientLEId, fieldNo' },
  { from: 'open, fieldNo, customFieldId, legalEntityId', to: 'open, fieldNo, customFieldId, clientLEId' },
  { from: 'getLETeamMembers(legalEntityId)', to: 'getLETeamMembers(clientLEId)' },
  { from: 'getFieldDetail(legalEntityId', to: 'getFieldDetail(clientLEId' },
  { from: 'getMasterFieldDocuments(legalEntityId', to: 'getMasterFieldDocuments(clientLEId' },
  { from: 'saveMasterFieldNote(legalEntityId', to: 'saveMasterFieldNote(clientLEId' },
  { from: 'promoteClaim(legalEntityId', to: 'promoteClaim(clientLEId' },
  { from: 'promoteClaimToCCParty(claimId, legalEntityId)', to: 'promoteClaimToCCParty(claimId, clientLEId)' },
  { from: 'saveAddressForReuse(claimId, legalEntityId)', to: 'saveAddressForReuse(claimId, clientLEId)' },
  { from: "form.append('leId', legalEntityId)", to: "form.append('leId', clientLEId)" },
  { from: 'addMultiValueEntry(legalEntityId', to: 'addMultiValueEntry(clientLEId' },
  { from: 'updateFieldManually(legalEntityId', to: 'updateFieldManually(clientLEId' },
  { from: 'removeMultiValueEntry(legalEntityId', to: 'removeMultiValueEntry(clientLEId' },
  { from: 'clientLEId: legalEntityId,', to: 'clientLEId: clientLEId,' },
  { from: 'clientLEId={legalEntityId}', to: 'clientLEId={clientLEId}' },
  { from: 'legalEntityId, customFieldId', to: 'clientLEId, customFieldId' },
  { from: 'updateCustomFieldManually(legalEntityId', to: 'updateCustomFieldManually(clientLEId' },
  { from: 'applyBulkOverride(legalEntityId', to: 'applyBulkOverride(clientLEId' },
  { from: 'applyCandidate(legalEntityId', to: 'applyCandidate(clientLEId' },
  { from: 'setMasterFieldAssignment(legalEntityId', to: 'setMasterFieldAssignment(clientLEId' },
  { from: 'clientLEId: legalEntityId', to: 'clientLEId: clientLEId' },
  { from: 'legalEntityId,\n', to: 'clientLEId,\n' },
];

for (const rep of occurrences) {
    content = content.split(rep.from).join(rep.to);
}

fs.writeFileSync(file, content, 'utf8');
console.log("Done");
