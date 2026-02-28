
// ============================================================================
// LEActivity Schema & Constants
// Safe for both Client and Server environments.
// ============================================================================

export const LEActivityType = {
    // Compliance
    QUESTION_ANSWERED: "QUESTION_ANSWERED",
    QUESTION_UPDATED: "QUESTION_UPDATED",

    // Documents
    DOC_UPLOADED: "DOC_UPLOADED",
    DOC_DELETED: "DOC_DELETED",

    // Relationships (Banks / FIs)
    BANK_INVITED: "BANK_INVITED",
    BANK_CONNECTED: "BANK_CONNECTED",
    ENGAGEMENT_STATUS_CHANGED: "ENGAGEMENT_STATUS_CHANGED",

    // Team
    TEAM_MEMBER_INVITED: "TEAM_MEMBER_INVITED",
    TEAM_MEMBER_JOINED: "TEAM_MEMBER_JOINED",
    TEAM_MEMBER_REMOVED: "TEAM_MEMBER_REMOVED",

    // Standing Data / Identity
    LEI_VERIFIED: "LEI_VERIFIED",
    REGISTRY_REFRESHED: "REGISTRY_REFRESHED",
    STANDING_DATA_UPDATED: "STANDING_DATA_UPDATED",

    // Questionnaires
    QUESTIONNAIRE_ASSIGNED: "QUESTIONNAIRE_ASSIGNED",
    QUESTIONNAIRE_SUBMITTED: "QUESTIONNAIRE_SUBMITTED",
} as const;

export type LEActivityTypeValue = typeof LEActivityType[keyof typeof LEActivityType];

// Human-readable labels and icons for each event type
export const ACTIVITY_META: Record<LEActivityTypeValue, {
    label: string;
    icon: string;       // lucide icon name
    colour: string;     // tailwind text colour class
    bgColour: string;   // tailwind bg colour class
}> = {
    QUESTION_ANSWERED: { label: "answered a question", icon: "MessageSquare", colour: "text-emerald-600", bgColour: "bg-emerald-50" },
    QUESTION_UPDATED: { label: "updated an answer", icon: "Pencil", colour: "text-blue-600", bgColour: "bg-blue-50" },
    DOC_UPLOADED: { label: "uploaded a document", icon: "Upload", colour: "text-violet-600", bgColour: "bg-violet-50" },
    DOC_DELETED: { label: "deleted a document", icon: "Trash2", colour: "text-red-500", bgColour: "bg-red-50" },
    BANK_INVITED: { label: "invited a bank", icon: "Send", colour: "text-indigo-600", bgColour: "bg-indigo-50" },
    BANK_CONNECTED: { label: "bank connected", icon: "Link2", colour: "text-emerald-600", bgColour: "bg-emerald-50" },
    ENGAGEMENT_STATUS_CHANGED: { label: "engagement status changed", icon: "RefreshCw", colour: "text-amber-600", bgColour: "bg-amber-50" },
    TEAM_MEMBER_INVITED: { label: "invited a team member", icon: "UserPlus", colour: "text-indigo-600", bgColour: "bg-indigo-50" },
    TEAM_MEMBER_JOINED: { label: "joined the team", icon: "Users", colour: "text-emerald-600", bgColour: "bg-emerald-50" },
    TEAM_MEMBER_REMOVED: { label: "removed a team member", icon: "UserMinus", colour: "text-red-500", bgColour: "bg-red-50" },
    LEI_VERIFIED: { label: "LEI verified", icon: "ShieldCheck", colour: "text-emerald-600", bgColour: "bg-emerald-50" },
    REGISTRY_REFRESHED: { label: "registry data refreshed", icon: "RefreshCw", colour: "text-slate-600", bgColour: "bg-slate-50" },
    STANDING_DATA_UPDATED: { label: "updated standing data", icon: "Database", colour: "text-blue-600", bgColour: "bg-blue-50" },
    QUESTIONNAIRE_ASSIGNED: { label: "questionnaire assigned", icon: "ClipboardList", colour: "text-indigo-600", bgColour: "bg-indigo-50" },
    QUESTIONNAIRE_SUBMITTED: { label: "submitted a questionnaire", icon: "CheckCircle2", colour: "text-emerald-600", bgColour: "bg-emerald-50" },
};
