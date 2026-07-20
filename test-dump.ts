import { test, expect } from 'vitest';
import { resolveFieldCollectionForDisplay } from './src/lib/master-data/field-interpreter';

const data = { firstName: 'Embedded', lastName: 'Source' };
const res = resolveFieldCollectionForDisplay(
    [{ value: data, sourceType: 'COMPANIES_HOUSE', sourceReference: 'RA000585', instanceId: 'inst-1' }],
    { fieldNo: 63, label: 'Mixed Parties', appDataType: 'PARTY', isMultiValue: true } as any
);

console.log(JSON.stringify(res.value.items[0], null, 2));
