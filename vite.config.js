import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'fs'
import { resolve } from 'path'

// Copy PDF.js worker to public directory
try {
  copyFileSync(
    resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.mjs'),
    resolve(__dirname, 'public/pdf.worker.js')
  )
  console.log('PDF.js worker copied successfully')
} catch (err) {
  console.error('Failed to copy PDF.js worker:', err)
}

export default defineConfig({
  plugins: [react()],
  base: './', // Fix for Electron - use relative paths
  optimizeDeps: {
    include: ['pdfjs-dist']
  },
  define: {
    global: 'globalThis',
  }
})