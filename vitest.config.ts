import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
    test: {
        pool: 'threads',
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
})




