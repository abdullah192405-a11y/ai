import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import { websiteResolveAliases } from '@wba/dashboard-ui/vite.config.shared'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5180,
    },
    resolve: {
        dedupe: ['react', 'react-dom'],
        alias: websiteResolveAliases(__dirname),
    },
})
