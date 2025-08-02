import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync } from 'fs'
import { resolve } from 'path'

// Copy PDF.js worker to public directory 
try {
  const workerSrc = resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.mjs')
  const workerDest = resolve(__dirname, 'public/pdf.worker.mjs')
  
  if (existsSync(workerSrc)) {
    copyFileSync(workerSrc, workerDest)
    console.log('✅ PDF.js worker copied to public directory')
  } else {
    console.warn('⚠️  PDF.js worker not found, will use URL import')
  }
} catch (err) {
  console.warn('⚠️  Failed to copy PDF.js worker:', err.message)
}

export default defineConfig({
  plugins: [react()],
  base: './', // Fix for Electron - use relative paths
  server: {
    port: 5200,
    strictPort: true, // Fail if port 5200 is not available
    host: 'localhost'
  },
  optimizeDeps: {
    include: ['pdfjs-dist']
  },
  define: {
    global: 'globalThis'
  }
})