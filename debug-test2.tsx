import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// just to make vitest functions not throw
(global as any).describe = (name: string, fn: any) => { console.log(name); fn(); };
(global as any).it = (name: string, fn: any) => {
    console.log("  " + name);
    try { fn(); console.log("  PASS"); } catch (e) { console.error("  FAIL:", e); }
};
(global as any).expect = (val: any) => ({
    toBeInTheDocument: () => { if (!val) throw new Error("not in document"); },
    toHaveLength: (len: number) => { if (val.length !== len) throw new Error("length mismatch"); },
    toBeGreaterThan: (len: number) => { if (val.length <= len) throw new Error("length not greater"); }
});
(global as any).vi = { mock: () => {}, fn: () => () => ({}) };

import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost/' });
global.window = dom.window as any;
global.document = dom.window.document as any;
global.navigator = dom.window.navigator;

import './src/components/client/__tests__/data-schema-tab.master.test.tsx';
