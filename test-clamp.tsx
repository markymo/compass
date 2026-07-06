import React from 'react';
import { renderToString } from 'react-dom/server';
import { ExpandableText } from './src/components/ui/expandable-text';

console.log(renderToString(<ExpandableText text="test\ntest\ntest\ntest\ntest" maxLines={4} />));
