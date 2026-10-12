"use client";

export const DOCUMENT_ATTACHMENT_CHANGED = "onpro:document-attachment-changed";

/** Notify mounted workbench lists in this tab and other same-origin tabs. */
export function notifyDocumentAttachmentChanged(payload?: { clientLEId?: string; fieldNo?: number }) {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(DOCUMENT_ATTACHMENT_CHANGED, { detail: payload }));
    try {
        localStorage.setItem(
            DOCUMENT_ATTACHMENT_CHANGED,
            JSON.stringify({ ...payload, ts: Date.now(), rand: crypto.randomUUID() })
        );
    } catch {
        // Storage access may be denied in some sandboxes
    }
}
