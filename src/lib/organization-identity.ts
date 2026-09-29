type OrganizationIdentity = {
    id: string;
    name: string;
    shortCode?: string | null;
    domain?: string | null;
};

/** Always retain a stable identifier, even when names or domains are shared. */
export function organizationDescription(org: OrganizationIdentity): string {
    return [org.shortCode, org.domain, `ID: ${org.id}`].filter(Boolean).join(" · ");
}

export function organizationLabel(org: OrganizationIdentity): string {
    return `${org.name.trim()} — ${organizationDescription(org)}`;
}
