import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost/',
});
global.window = dom.window as any;
global.document = dom.window.document as any;
global.navigator = dom.window.navigator;

import React from 'react';
import { render } from '@testing-library/react';
import { DataSchemaTab } from './src/components/client/data-schema-tab';

// Mocks
jest = { fn: () => () => {} } as any;

const categories = [
    {
        id: 'cat-1',
        key: 'cat-1',
        displayName: 'Test Category',
        fields: [
            { fieldNo: 62, fieldName: 'Ultimate Beneficial Owners', appDataType: 'PARTY', isMultiValue: true }
        ]
    }
];

const masterData = {
    62: {
        value: [
            { firstName: 'Alice', lastName: 'Smith', metadata_type: 'PERSON' }
        ],
        source: 'COMPANIES_HOUSE',
        displayState: 'HAS_VALUE',
        canonicalDisplayModel: {
            fieldNo: 62,
            label: 'Ultimate Beneficial Owners',
            state: 'POPULATED',
            isMultiValue: true,
            source: {
                type: 'COMPANIES_HOUSE',
                reference: 'RA000585',
                label: 'Companies House - RA000585',
                colorKey: 'REGISTRY'
            },
            value: {
                kind: 'collection',
                items: [
                    {
                        value: { kind: 'party', partyLabel: 'Alice Smith', data: { firstName: 'Alice', lastName: 'Smith' } },
                        source: { type: 'COMPANIES_HOUSE', reference: 'RA000585', label: 'Companies House - RA000585', colorKey: 'REGISTRY' }
                    }
                ]
            }
        }
    }
};

try {
    const { container } = render(
        <DataSchemaTab
            leId="cle_1"
            masterData={masterData}
            customData={{}}
            customDefinitions={[]}
            masterFields={[]}
            masterGroups={[]}
            categories={categories}
            uncategorizedFields={[]}
        />
    );
    console.log(container.innerHTML);
} catch (err) {
    console.error(err);
}
