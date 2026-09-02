import { Action } from "@/lib/auth/permissions";

export interface ActionDocumentation {
    action: Action;
    name: string;
    scope: "Platform" | "Organisation" | "ClientLE" | "Relationship" | "Organisation / Relationship";
    summary: string;
    description: string;
    restrictions?: string;
}

export interface ActionMatrixRow {
    action: Action;
    category: "Platform Administration" | "Organisation Administration" | "ClientLE Structure & Provisioning" | "Operational Master Data" | "Relationship Lifecycle" | "Relationship Responses & Team" | "Questionnaire Templates";
    categoryColor: string;
    sysAdmin: "✓" | "—";
    orgAdmin: "✓" | "—" | "CLIENT" | "SUPPLIER";
    orgMember: "✓" | "—";
    leAdmin: "✓" | "—";
    leUser: "✓" | "—";
    relAdmin: "✓" | "—";
    relUser: "✓" | "—";
    note?: string;
}

/**
 * Authoritative documentation metadata for all OnPro authorization actions.
 * Compile-time type completeness ensures any added Action enum must be documented here.
 */
export const ACTION_DOCUMENTATION: Record<Action, ActionDocumentation> = {
    // ==========================================
    // 1. Platform Administration (System Admin)
    // ==========================================
    [Action.SYSTEM_MANAGE_PLATFORM]: {
        action: Action.SYSTEM_MANAGE_PLATFORM,
        name: "Manage Platform Assets",
        scope: "Platform",
        summary: "Administer OnPro platform schemas, reference questionnaires, and mapping tools.",
        description: "Administer OnPro-owned platform configuration such as Master Data schema definitions, taxonomy ordering, AI field mappings, reference questionnaire templates, and internal demo seed tools. Applies strictly to platform-owned assets.",
        restrictions: "Does not grant access to customer operational KYC data, live engagement relationships, or private customer documents.",
    },
    [Action.SYSTEM_MANAGE_TENANTS]: {
        action: Action.SYSTEM_MANAGE_TENANTS,
        name: "Manage Tenants & Users",
        scope: "Platform",
        summary: "Create and administer tenant organisations, accounts, memberships, and invitations across OnPro.",
        description: "Create and administer OnPro tenant organisations, users, memberships, and invitations across the ecosystem. Includes tenant onboarding and cross-tenant organisation administration.",
        restrictions: "Operates strictly at the account/tenant management layer; does not grant ClientLE or relationship customer operational access.",
    },
    [Action.SYSTEM_VIEW_TELEMETRY]: {
        action: Action.SYSTEM_VIEW_TELEMETRY,
        name: "View Platform Telemetry",
        scope: "Platform",
        summary: "View platform-wide telemetry, pulse logs, ecosystem metrics, and diagnostic routes.",
        description: "View platform-wide operational telemetry, aggregated system statistics, ecosystem hierarchy trees, pulse activity logs, and diagnostic routes (e.g. Sentry testing, live payload inspection).",
        restrictions: "Read-only access to system telemetry and aggregate metadata; does not permit inspecting customer KYC dossier values.",
    },
    [Action.SYSTEM_RESTORE]: {
        action: Action.SYSTEM_RESTORE,
        name: "Restore Soft-Deleted Resources",
        scope: "Platform",
        summary: "Recover and restore soft-deleted ClientLE dossiers.",
        description: "Restore supported soft-deleted platform and tenant resources through approved System Admin recovery operations, specifically un-deleting soft-deleted Client Legal Entity (ClientLE) dossiers.",
        restrictions: "Restricted to platform administrators performing operational disaster recovery or accidental deletion reversals.",
    },
    [Action.SYSTEM_HARD_DELETE]: {
        action: Action.SYSTEM_HARD_DELETE,
        name: "Hard Delete Resources",
        scope: "Platform",
        summary: "Permanently purge and delete ClientLE dossiers or empty organisations.",
        description: "Permanently delete resources through approved System Admin purge operations, such as irreversible hard deletion of soft-deleted ClientLE dossiers or eligible empty tenant organisations.",
        restrictions: "Irreversible purge capability strictly reserved for authorized System Administrators.",
    },

    // ==========================================
    // 2. Organisation Administration
    // ==========================================
    [Action.ORG_MANAGE_TEAM]: {
        action: Action.ORG_MANAGE_TEAM,
        name: "Manage Organisation Team",
        scope: "Organisation",
        summary: "Invite members and manage organisation-level roles and memberships.",
        description: "Manage organisation-level memberships and invitations for the organisation in scope. Includes inviting team members, assigning organisation-level roles (ORG_ADMIN, ORG_MEMBER), and revoking memberships.",
        restrictions: "Scoped strictly to the target organisation; grants no access to operational ClientLE data or relationship responses.",
    },
    [Action.ORG_MANAGE_BILLING]: {
        action: Action.ORG_MANAGE_BILLING,
        name: "Manage Organisation Billing",
        scope: "Organisation",
        summary: "View and update commercial billing details and subscriptions.",
        description: "View and update commercial billing configuration, subscription tiers, payment details, and invoice histories for the organisation in scope.",
        restrictions: "Purely commercial administration; does not require or grant operational data access.",
    },
    [Action.ORG_SELF_JOIN_LE]: {
        action: Action.ORG_SELF_JOIN_LE,
        name: "Self-Join ClientLE (Break-Glass)",
        scope: "Organisation",
        summary: "Explicitly provision ClientLE membership for an authorized Client Org Admin.",
        description: "Allows an authorized Client organisation administrator (ORG_ADMIN) to explicitly create an operational ClientLE membership (LE_ADMIN) for themselves rather than receiving implicit automatic access.",
        restrictions: "Available only to ORG_ADMIN for CLIENT organisations. Requires an explicit provisioning action to maintain an audited operational boundary.",
    },

    // ==========================================
    // 3. ClientLE Lifecycle & Provisioning
    // ==========================================
    [Action.LE_CREATE]: {
        action: Action.LE_CREATE,
        name: "Create Client Legal Entity",
        scope: "Organisation",
        summary: "Provision and initialize a new ClientLE dossier under the organisation.",
        description: "Provision and initialize new Client Legal Entity (ClientLE) records and their associated dossier structures under the owning Client organisation.",
        restrictions: "Restricted to ORG_ADMIN of CLIENT organisations.",
    },
    [Action.LE_UPDATE]: {
        action: Action.LE_UPDATE,
        name: "Update Client Legal Entity",
        scope: "ClientLE",
        summary: "Modify ClientLE entity metadata, legal name, LEI, or jurisdiction.",
        description: "Modify Client Legal Entity structural properties, including legal entity name, jurisdiction metadata, LEI registration, and dossier settings.",
        restrictions: "Granted to Client ORG_ADMIN (for tenant structure) and assigned LE_ADMIN (for operational entity).",
    },
    [Action.LE_ARCHIVE]: {
        action: Action.LE_ARCHIVE,
        name: "Archive Client Legal Entity",
        scope: "ClientLE",
        summary: "Archive or soft-delete a ClientLE dossier.",
        description: "Archive or soft-delete a Client Legal Entity and its associated dossier workspaces, removing it from active client workflows.",
        restrictions: "Granted to Client ORG_ADMIN and assigned LE_ADMIN.",
    },
    [Action.LE_MANAGE_USERS]: {
        action: Action.LE_MANAGE_USERS,
        name: "Manage ClientLE Users",
        scope: "ClientLE",
        summary: "Assign and manage user roles directly on the ClientLE.",
        description: "Invite, assign, and manage users with direct operational access (LE_ADMIN, LE_USER) to the specific Client Legal Entity.",
        restrictions: "Granted to Client ORG_ADMIN and assigned LE_ADMIN.",
    },

    // ==========================================
    // 4. Operational Master Data (ClientLE)
    // ==========================================
    [Action.LE_VIEW_MASTER_DATA]: {
        action: Action.LE_VIEW_MASTER_DATA,
        name: "View Master Data Dossier",
        scope: "ClientLE",
        summary: "View canonical KYC dossier data and uploaded verification documents.",
        description: "View the ClientLE's operational Master Data, canonical KYC dossier values, ownership structure, and attached private verification documents.",
        restrictions: "Operational permission requiring explicit ClientLE membership (LE_ADMIN or LE_USER).",
    },
    [Action.LE_EDIT_MASTER_DATA]: {
        action: Action.LE_EDIT_MASTER_DATA,
        name: "Edit Master Data Dossier",
        scope: "ClientLE",
        summary: "Create and update operational Master Data field values and attachments.",
        description: "Create, edit, and update operational Master Data values, field answers, manual overrides, custom field mappings, and document attachments on the ClientLE.",
        restrictions: "Operational editing permission requiring explicit ClientLE membership (LE_ADMIN or LE_USER).",
    },
    [Action.LE_SIGNOFF_MASTER_DATA]: {
        action: Action.LE_SIGNOFF_MASTER_DATA,
        name: "Sign Off Master Data",
        scope: "ClientLE",
        summary: "Perform formal ClientLE-level sign-off on canonical Master Data values.",
        description: "Perform formal ClientLE-level sign-off and approval of canonical Master Data dossier values where sign-off is required by the workflow.",
        restrictions: "Granted exclusively to LE_ADMIN on the target ClientLE; denied to LE_USER.",
    },

    // ==========================================
    // 5. Relationship / Engagement Lifecycle
    // ==========================================
    [Action.ENG_CREATE]: {
        action: Action.ENG_CREATE,
        name: "Create Relationship Engagement",
        scope: "Relationship",
        summary: "Initiate a new counterparty engagement workspace.",
        description: "Initiate and establish a new counterparty engagement workspace between a Client Legal Entity and a Supplier/FI organisation.",
        restrictions: "Granted to assigned ClientLE members initiating engagements.",
    },
    [Action.ENG_VIEW]: {
        action: Action.ENG_VIEW,
        name: "View Relationship Engagement",
        scope: "Relationship",
        summary: "View relationship details, status, and counterparty metadata.",
        description: "View the relationship overview, counterparty details, status badges, and timeline for an active engagement relationship.",
        restrictions: "Available to assigned relationship participants on both Client and Supplier sides.",
    },
    [Action.ENG_UPDATE]: {
        action: Action.ENG_UPDATE,
        name: "Update Relationship Engagement",
        scope: "Relationship",
        summary: "Update relationship configuration, settings, or deadlines.",
        description: "Update relationship metadata, engagement parameters, configuration settings, and submission deadlines.",
        restrictions: "Granted to operational leads and workers assigned to the relationship.",
    },
    [Action.ENG_DELETE]: {
        action: Action.ENG_DELETE,
        name: "Delete Relationship Engagement",
        scope: "Relationship",
        summary: "Cancel or delete an engagement relationship.",
        description: "Cancel, archive, or remove an engagement relationship workspace.",
        restrictions: "Granted to assigned Client LE_ADMIN managing the parent ClientLE.",
    },

    // ==========================================
    // 6. Operational Relationship Data & Responses
    // ==========================================
    [Action.ENG_VIEW_RELEASED_DATA]: {
        action: Action.ENG_VIEW_RELEASED_DATA,
        name: "View Released Relationship Data",
        scope: "Relationship",
        summary: "View released KYC data and responses within the relationship workspace.",
        description: "View released operational data, shared counterparty documents, and questionnaire information for the relationship in scope.",
        restrictions: "Strictly bounded to the assigned engagement relationship; grants no access to unreleased master data or other relationships.",
    },
    [Action.ENG_EDIT_DRAFT_RESPONSES]: {
        action: Action.ENG_EDIT_DRAFT_RESPONSES,
        name: "Edit Draft Questionnaire Responses",
        scope: "Relationship",
        summary: "Create and update draft questionnaire answers for the relationship.",
        description: "Create and update draft questionnaire responses, field answers, and relationship-specific query resolutions for the relationship in scope.",
        restrictions: "Operational response editing permission for assigned relationship workers and leads.",
    },
    [Action.ENG_SIGNOFF_RESPONSES]: {
        action: Action.ENG_SIGNOFF_RESPONSES,
        name: "Sign Off Relationship Responses",
        scope: "Relationship",
        summary: "Sign off and formally submit relationship questionnaire responses.",
        description: "Sign off and formally submit relationship-scoped questionnaire responses where the current workflow permits sign-off.",
        restrictions: "Granted to operational leads (LE_ADMIN on client side, RELATIONSHIP_ADMIN on supplier side; denied to _USER roles).",
    },
    [Action.ENG_MANAGE_USERS]: {
        action: Action.ENG_MANAGE_USERS,
        name: "Manage Relationship Users",
        scope: "Relationship",
        summary: "Assign and manage users on a specific engagement relationship.",
        description: "Assign, manage, and remove team members (RELATIONSHIP_ADMIN, RELATIONSHIP_USER) on a specific engagement relationship.",
        restrictions: "Granted to LE_ADMIN (client side), RELATIONSHIP_ADMIN (supplier side), and Supplier ORG_ADMIN for owned relationships.",
    },

    // ==========================================
    // 7. Reusable Questionnaire Templates (Supplier Org)
    // ==========================================
    [Action.QUESTIONNAIRE_CREATE]: {
        action: Action.QUESTIONNAIRE_CREATE,
        name: "Create Reusable Questionnaire Template",
        scope: "Organisation",
        summary: "Create tenant-owned reusable questionnaire templates.",
        description: "Create new tenant-owned reusable questionnaire templates in the organisation's questionnaire library or clone reference templates. When granted through ORG_ADMIN, applies strictly to Supplier-capable organisations.",
        restrictions: "Available to ORG_ADMIN for Supplier-capable organisations. Does not administer System-owned reference questionnaires (which require SYSTEM_MANAGE_PLATFORM).",
    },
    [Action.QUESTIONNAIRE_UPDATE]: {
        action: Action.QUESTIONNAIRE_UPDATE,
        name: "Update Questionnaire Template / Response",
        scope: "Organisation / Relationship",
        summary: "Update tenant-owned reusable templates (Org scope) or engagement questionnaires (Relationship scope).",
        description: "Edit, update sections and questions, and configure tenant-owned reusable questionnaire templates in the organisation library, or update engagement-specific questionnaires within an assigned relationship.",
        restrictions: "Operates on tenant-owned templates in Org scope or relationship questionnaires in Engagement scope; does not authorize changes to System-owned reference templates.",
    },
    [Action.QUESTIONNAIRE_DELETE]: {
        action: Action.QUESTIONNAIRE_DELETE,
        name: "Delete Questionnaire Template",
        scope: "Organisation",
        summary: "Delete or archive tenant-owned reusable questionnaire templates.",
        description: "Delete or archive tenant-owned reusable questionnaire templates from the organisation's questionnaire library.",
        restrictions: "Restricted to ORG_ADMIN of Supplier-capable organisations.",
    },
};

/**
 * Technical Action Matrix Rows ordered logically by security domain.
 */
export const ACTION_MATRIX_ROWS: ActionMatrixRow[] = [
    // 1. Platform Administration
    {
        action: Action.SYSTEM_MANAGE_PLATFORM,
        category: "Platform Administration",
        categoryColor: "bg-purple-50/40 dark:bg-purple-950/20 text-purple-900 dark:text-purple-300",
        sysAdmin: "✓",
        orgAdmin: "—",
        orgMember: "—",
        leAdmin: "—",
        leUser: "—",
        relAdmin: "—",
        relUser: "—",
    },
    {
        action: Action.SYSTEM_MANAGE_TENANTS,
        category: "Platform Administration",
        categoryColor: "bg-purple-50/40 dark:bg-purple-950/20 text-purple-900 dark:text-purple-300",
        sysAdmin: "✓",
        orgAdmin: "—",
        orgMember: "—",
        leAdmin: "—",
        leUser: "—",
        relAdmin: "—",
        relUser: "—",
    },
    {
        action: Action.SYSTEM_VIEW_TELEMETRY,
        category: "Platform Administration",
        categoryColor: "bg-purple-50/40 dark:bg-purple-950/20 text-purple-900 dark:text-purple-300",
        sysAdmin: "✓",
        orgAdmin: "—",
        orgMember: "—",
        leAdmin: "—",
        leUser: "—",
        relAdmin: "—",
        relUser: "—",
    },
    {
        action: Action.SYSTEM_RESTORE,
        category: "Platform Administration",
        categoryColor: "bg-purple-50/40 dark:bg-purple-950/20 text-purple-900 dark:text-purple-300",
        sysAdmin: "✓",
        orgAdmin: "—",
        orgMember: "—",
        leAdmin: "—",
        leUser: "—",
        relAdmin: "—",
        relUser: "—",
    },
    {
        action: Action.SYSTEM_HARD_DELETE,
        category: "Platform Administration",
        categoryColor: "bg-purple-50/40 dark:bg-purple-950/20 text-purple-900 dark:text-purple-300",
        sysAdmin: "✓",
        orgAdmin: "—",
        orgMember: "—",
        leAdmin: "—",
        leUser: "—",
        relAdmin: "—",
        relUser: "—",
    },

    // 2. Organisation Administration
    {
        action: Action.ORG_MANAGE_TEAM,
        category: "Organisation Administration",
        categoryColor: "bg-amber-50/40 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300",
        sysAdmin: "—",
        orgAdmin: "✓",
        orgMember: "—",
        leAdmin: "—",
        leUser: "—",
        relAdmin: "—",
        relUser: "—",
    },
    {
        action: Action.ORG_MANAGE_BILLING,
        category: "Organisation Administration",
        categoryColor: "bg-amber-50/40 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300",
        sysAdmin: "—",
        orgAdmin: "✓",
        orgMember: "—",
        leAdmin: "—",
        leUser: "—",
        relAdmin: "—",
        relUser: "—",
    },
    {
        action: Action.ORG_SELF_JOIN_LE,
        category: "Organisation Administration",
        categoryColor: "bg-amber-50/40 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300",
        sysAdmin: "—",
        orgAdmin: "CLIENT",
        orgMember: "—",
        leAdmin: "—",
        leUser: "—",
        relAdmin: "—",
        relUser: "—",
    },

    // 3. ClientLE Structure & Provisioning
    {
        action: Action.LE_CREATE,
        category: "ClientLE Structure & Provisioning",
        categoryColor: "bg-amber-50/40 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300",
        sysAdmin: "—",
        orgAdmin: "CLIENT",
        orgMember: "—",
        leAdmin: "—",
        leUser: "—",
        relAdmin: "—",
        relUser: "—",
    },
    {
        action: Action.LE_UPDATE,
        category: "ClientLE Structure & Provisioning",
        categoryColor: "bg-amber-50/40 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300",
        sysAdmin: "—",
        orgAdmin: "CLIENT",
        orgMember: "—",
        leAdmin: "✓",
        leUser: "—",
        relAdmin: "—",
        relUser: "—",
    },
    {
        action: Action.LE_ARCHIVE,
        category: "ClientLE Structure & Provisioning",
        categoryColor: "bg-amber-50/40 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300",
        sysAdmin: "—",
        orgAdmin: "CLIENT",
        orgMember: "—",
        leAdmin: "✓",
        leUser: "—",
        relAdmin: "—",
        relUser: "—",
    },
    {
        action: Action.LE_MANAGE_USERS,
        category: "ClientLE Structure & Provisioning",
        categoryColor: "bg-amber-50/40 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300",
        sysAdmin: "—",
        orgAdmin: "CLIENT",
        orgMember: "—",
        leAdmin: "✓",
        leUser: "—",
        relAdmin: "—",
        relUser: "—",
    },

    // 4. Operational Master Data (ClientLE)
    {
        action: Action.LE_VIEW_MASTER_DATA,
        category: "Operational Master Data",
        categoryColor: "bg-blue-50/40 dark:bg-blue-950/20 text-blue-900 dark:text-blue-300",
        sysAdmin: "—",
        orgAdmin: "—",
        orgMember: "—",
        leAdmin: "✓",
        leUser: "✓",
        relAdmin: "—",
        relUser: "—",
    },
    {
        action: Action.LE_EDIT_MASTER_DATA,
        category: "Operational Master Data",
        categoryColor: "bg-blue-50/40 dark:bg-blue-950/20 text-blue-900 dark:text-blue-300",
        sysAdmin: "—",
        orgAdmin: "—",
        orgMember: "—",
        leAdmin: "✓",
        leUser: "✓",
        relAdmin: "—",
        relUser: "—",
    },
    {
        action: Action.LE_SIGNOFF_MASTER_DATA,
        category: "Operational Master Data",
        categoryColor: "bg-blue-50/40 dark:bg-blue-950/20 text-blue-900 dark:text-blue-300",
        sysAdmin: "—",
        orgAdmin: "—",
        orgMember: "—",
        leAdmin: "✓",
        leUser: "—",
        relAdmin: "—",
        relUser: "—",
    },

    // 5. Relationship / Engagement Lifecycle
    {
        action: Action.ENG_CREATE,
        category: "Relationship Lifecycle",
        categoryColor: "bg-slate-50 dark:bg-slate-900/40 text-slate-900 dark:text-slate-200",
        sysAdmin: "—",
        orgAdmin: "—",
        orgMember: "—",
        leAdmin: "✓",
        leUser: "✓",
        relAdmin: "—",
        relUser: "—",
    },
    {
        action: Action.ENG_VIEW,
        category: "Relationship Lifecycle",
        categoryColor: "bg-slate-50 dark:bg-slate-900/40 text-slate-900 dark:text-slate-200",
        sysAdmin: "—",
        orgAdmin: "—",
        orgMember: "—",
        leAdmin: "✓",
        leUser: "✓",
        relAdmin: "✓",
        relUser: "✓",
    },
    {
        action: Action.ENG_UPDATE,
        category: "Relationship Lifecycle",
        categoryColor: "bg-slate-50 dark:bg-slate-900/40 text-slate-900 dark:text-slate-200",
        sysAdmin: "—",
        orgAdmin: "—",
        orgMember: "—",
        leAdmin: "✓",
        leUser: "✓",
        relAdmin: "✓",
        relUser: "✓",
    },
    {
        action: Action.ENG_DELETE,
        category: "Relationship Lifecycle",
        categoryColor: "bg-slate-50 dark:bg-slate-900/40 text-slate-900 dark:text-slate-200",
        sysAdmin: "—",
        orgAdmin: "—",
        orgMember: "—",
        leAdmin: "✓",
        leUser: "—",
        relAdmin: "—",
        relUser: "—",
    },

    // 6. Operational Relationship Data & Responses
    {
        action: Action.ENG_VIEW_RELEASED_DATA,
        category: "Relationship Responses & Team",
        categoryColor: "bg-teal-50/40 dark:bg-teal-950/20 text-teal-900 dark:text-teal-300",
        sysAdmin: "—",
        orgAdmin: "—",
        orgMember: "—",
        leAdmin: "✓",
        leUser: "✓",
        relAdmin: "✓",
        relUser: "✓",
    },
    {
        action: Action.ENG_EDIT_DRAFT_RESPONSES,
        category: "Relationship Responses & Team",
        categoryColor: "bg-teal-50/40 dark:bg-teal-950/20 text-teal-900 dark:text-teal-300",
        sysAdmin: "—",
        orgAdmin: "—",
        orgMember: "—",
        leAdmin: "✓",
        leUser: "✓",
        relAdmin: "✓",
        relUser: "✓",
    },
    {
        action: Action.ENG_SIGNOFF_RESPONSES,
        category: "Relationship Responses & Team",
        categoryColor: "bg-teal-50/40 dark:bg-teal-950/20 text-teal-900 dark:text-teal-300",
        sysAdmin: "—",
        orgAdmin: "—",
        orgMember: "—",
        leAdmin: "✓",
        leUser: "—",
        relAdmin: "✓",
        relUser: "—",
    },
    {
        action: Action.ENG_MANAGE_USERS,
        category: "Relationship Responses & Team",
        categoryColor: "bg-teal-50/40 dark:bg-teal-950/20 text-teal-900 dark:text-teal-300",
        sysAdmin: "—",
        orgAdmin: "SUPPLIER",
        orgMember: "—",
        leAdmin: "✓",
        leUser: "—",
        relAdmin: "✓",
        relUser: "—",
    },

    // 7. Reusable Questionnaire Templates (Supplier Org)
    {
        action: Action.QUESTIONNAIRE_CREATE,
        category: "Questionnaire Templates",
        categoryColor: "bg-amber-50/40 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300",
        sysAdmin: "—",
        orgAdmin: "SUPPLIER",
        orgMember: "—",
        leAdmin: "—",
        leUser: "—",
        relAdmin: "—",
        relUser: "—",
    },
    {
        action: Action.QUESTIONNAIRE_UPDATE,
        category: "Questionnaire Templates",
        categoryColor: "bg-amber-50/40 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300",
        sysAdmin: "—",
        orgAdmin: "SUPPLIER",
        orgMember: "—",
        leAdmin: "—",
        leUser: "—",
        relAdmin: "✓",
        relUser: "—",
        note: "RELATIONSHIP_ADMIN holds questionnaire:update for relationship-scoped questionnaires",
    },
    {
        action: Action.QUESTIONNAIRE_DELETE,
        category: "Questionnaire Templates",
        categoryColor: "bg-amber-50/40 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300",
        sysAdmin: "—",
        orgAdmin: "SUPPLIER",
        orgMember: "—",
        leAdmin: "—",
        leUser: "—",
        relAdmin: "—",
        relUser: "—",
    },
];
