import { defineConfig, configDefaults } from 'vitest/config'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '.env') })
dotenv.config({ path: path.resolve(__dirname, '.env.local'), override: true })

export default defineConfig({
    test: {
        exclude: [...configDefaults.exclude, 'e2e/**', '.worktrees/**', '**/.worktrees/**'],
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
