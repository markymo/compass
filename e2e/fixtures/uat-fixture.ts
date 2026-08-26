import * as fs from 'fs';
import * as path from 'path';

export interface UATManifestActor {
    email: string;
    name: string;
    role: string;
}

export interface UATManifest {
    generatedAt: string;
    environment: string;
    systemOrg: { id: string; name: string; shortCode?: string };
    clientOrgA: { id: string; shortCode: string; name: string };
    clientOrgB: { id: string; shortCode: string; name: string };
    supplierOrgA: { id: string; shortCode: string; name: string };
    alphaClientLE: { id: string; shortCode: string; name: string };
    betaClientLE: { id: string; shortCode: string; name: string };
    relationshipAlpha: { id: string };
    relationshipBeta: { id: string };
    actors: {
        systemAdmin: UATManifestActor;
        clientOrgAdminA: UATManifestActor;
        clientOrgMemberA: UATManifestActor;
        leAdminAlpha: UATManifestActor;
        leUserAlpha: UATManifestActor;
        leUserBeta: UATManifestActor;
        supplierOrgAdminA: UATManifestActor;
        relationshipAdminAlpha: UATManifestActor;
        relationshipUserAlpha: UATManifestActor;
    };
}

export type UATActorKey = keyof UATManifest['actors'];

export const PERSONA_STORAGE_STATES: Record<UATActorKey, string> = {
    systemAdmin: 'playwright/.auth/system-admin.json',
    clientOrgAdminA: 'playwright/.auth/client-org-admin-a.json',
    clientOrgMemberA: 'playwright/.auth/client-org-member-a.json',
    leAdminAlpha: 'playwright/.auth/le-admin-alpha.json',
    leUserAlpha: 'playwright/.auth/le-user-alpha.json',
    leUserBeta: 'playwright/.auth/le-user-beta.json',
    supplierOrgAdminA: 'playwright/.auth/supplier-org-admin-a.json',
    relationshipAdminAlpha: 'playwright/.auth/relationship-admin-alpha.json',
    relationshipUserAlpha: 'playwright/.auth/relationship-user-alpha.json',
};

export function loadUATManifest(): UATManifest {
    const manifestPath = path.join(process.cwd(), 'playwright', '.uat', 'fixture.json');
    if (!fs.existsSync(manifestPath)) {
        throw new Error(
            'UAT fixture manifest not found at playwright/.uat/fixture.json. Please run "npm run uat:seed" first.'
        );
    }
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
}
