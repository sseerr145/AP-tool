import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// No longer copying PDF.js worker - we're using single-threaded mode

export default defineConfig({
  plugins: [react()],
  base: './', // Fix for Electron - use relative paths
  server: {
    port: 5200,
    strictPort: true, // Fail if port 5200 is not available
    host: 'localhost'
  },
  optimizeDeps: {
    include: ['pdfjs-dist'],
    // Exclude worker from optimization
    exclude: ['pdfjs-dist/build/pdf.worker.js', 'pdfjs-dist/build/pdf.worker.mjs']
  },
  define: {
    global: 'globalThis',
    // Signal that workers are disabled
    'process.env.PDF_WORKER_DISABLED': true
  },
  // Stub out any worker imports
  resolve: {
    alias: {
      'pdfjs-dist/build/pdf.worker.js': '/dev/null',
      'pdfjs-dist/build/pdf.worker.mjs': '/dev/null'
    }
  }
})