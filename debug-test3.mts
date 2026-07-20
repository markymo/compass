import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost/' });
(global as any).window = dom.window;
(global as any).document = dom.window.document;
(global as any).navigator = dom.window.navigator;

(global as any).describe = (name: string, fn: any) => { console.log(name); fn(); };
(global as any).it = (name: string, fn: any) => {
    console.log("  " + name);
    try { fn(); console.log("  PASS"); } catch (e) { console.error("  FAIL:", e); }
};
(global as any).expect = (val: any) => ({
    toBeInTheDocument: () => { if (!val) throw new Error("not in document"); },
    toHaveLength: (len: number) => { if (val.length !== len) throw new Error(`length mismatch: expected ${len}, got ${val.length}`); },
    toBeGreaterThan: (len: number) => { if (val.length <= len) throw new Error("length not greater"); }
});
(global as any).vi = { mock: () => {}, fn: () => () => ({}) };

await import('./src/components/client/__tests__/data-schema-tab.master.test.tsx');
