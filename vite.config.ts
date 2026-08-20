import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

export default defineConfig({
  base: '/VenkataSai-Aluminium-Dashboard/',
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
