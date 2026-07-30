import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
    test: {
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
