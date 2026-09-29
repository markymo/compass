"use client";

export const ORGANIZATION_MEMBERSHIP_CHANGED = "onpro:organization-membership-changed";

/** Notify mounted lists in this tab and other same-origin tabs. */
export function notifyOrganizationMembershipChanged() {
    window.dispatchEvent(new Event(ORGANIZATION_MEMBERSHIP_CHANGED));
    try {
        localStorage.setItem(ORGANIZATION_MEMBERSHIP_CHANGED, crypto.randomUUID());
    } catch {
        // Focus/pageshow refresh still works when storage is unavailable.
    }
}
