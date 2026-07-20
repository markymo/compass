const { JSDOM } = require('jsdom');
const React = require('react');
const { render } = require('@testing-library/react');
const { DataSchemaTab } = require('./src/components/client/data-schema-tab');

// But DataSchemaTab is in TypeScript and uses JSX. We cannot simply require it without babel/ts-node.
