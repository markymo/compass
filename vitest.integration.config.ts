import { defineConfig } from 'vitest/config'
import path from 'path'
import { dbIntegrationTestFiles } from './vitest.config'

export default defineConfig({
    test: {
        include: dbIntegrationTestFiles,
        pool: 'threads',
        fileParallelism: false,
        testTimeout: 30000,
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
