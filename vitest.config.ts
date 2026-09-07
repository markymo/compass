import { defineConfig, configDefaults } from 'vitest/config'
import path from 'path'

export const dbIntegrationTestFiles = [
    'scripts/run-visibility-migration.test.ts',
    'src/actions/__tests__/attachment-integration-part2.test.ts',
    'src/actions/__tests__/attachment-integration.test.ts',
    'src/actions/__tests__/common-questionnaires.test.ts',
    'src/actions/__tests__/inspect-query-output.test.ts',
    'src/actions/__tests__/kyc-manual-update-party-ref-smoke.test.ts',
    'src/actions/__tests__/legacy-released-fallback.test.ts',
    'src/actions/__tests__/multi-client-dossier-isolation.test.ts',
    'src/actions/__tests__/onp-121-shared-crud-auth.test.ts',
    'src/actions/__tests__/onp-34-questionnaire-version-mappings.test.ts',
    'src/actions/__tests__/onp-37-registry-provenance-db.integration.test.ts',
    'src/actions/__tests__/onp-40-mapping-semantics.test.ts',
    'src/actions/__tests__/onp-66-fi-overview-db.integration.test.ts',
    'src/actions/__tests__/onp-97-field-usage-auth.test.ts',
    'src/actions/__tests__/questionnaire-clone-mappings.test.ts',
    'src/actions/__tests__/questionnaire-engagement-context.test.ts',
    'src/actions/__tests__/questionnaire-visibility-hardening.test.ts',
    'src/actions/__tests__/questionnaire-visibility.test.ts',
    'src/actions/__tests__/reference-codes-integration.test.ts',
    'src/actions/__tests__/superset-working-copy.test.ts',
    'src/actions/__tests__/unresolved-subject-manual-update.test.ts',
    'src/lib/kyc/__tests__/onp-31-shared-usage.test.ts',
    'src/lib/kyc/__tests__/onp-39-reference-lifecycle.test.ts',
    'src/lib/kyc/__tests__/onp-49-attachment-policy.test.ts',
    'src/lib/kyc/__tests__/onp-51-address-editor-integration.test.ts',
    'src/lib/kyc/__tests__/onp-95-master-edit-precedence.test.ts',
    'src/services/__tests__/submissionService.test.ts',
];

export default defineConfig({
    test: {
        exclude: [
            ...configDefaults.exclude,
            'e2e/**',
            '.worktrees/**',
            '**/.worktrees/**',
            ...dbIntegrationTestFiles,
        ],
        pool: 'threads',
        server: {
            deps: {
                inline: ['next-auth'],
            },
        },
        alias: [
            { find: '@', replacement: path.resolve(__dirname, './src') },
            { find: /^next\/server$/, replacement: path.resolve(__dirname, './node_modules/next/server.js') },
        ],
    },
})
