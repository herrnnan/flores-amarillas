import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// whatsapp y compañia necesitan la url completa de la imagen de preview.
// en vercel sale sola del dominio, en local uso el de por defecto
const site = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : 'https://flores-amarillas.vercel.app'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    { name: 'site-url', transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', site) },
  ],
})
