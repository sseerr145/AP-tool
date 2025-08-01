import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// CRITICAL: Configure PDF.js immediately using direct import
import * as pdfjs from 'pdfjs-dist';

// Force disable worker immediately on window load
console.log('🔧 Configuring PDF.js at entry point...');

// Multiple approaches to ensure worker is disabled
pdfjs.GlobalWorkerOptions.disableWorker = true;
// Use CDN worker source (won't be used due to disableWorker, but satisfies validation)
pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'; 

// Also try setting on the global object directly
if (typeof window !== 'undefined') {
  window.pdfjs = pdfjs;
  
  // Monkey-patch Worker constructor 
  const OriginalWorker = window.Worker;
  window.Worker = class {
    constructor() {
      console.warn('🚫 Worker creation blocked for Electron compatibility');
      throw new Error('Workers are disabled in Electron renderer');
    }
  };
  window.OriginalWorker = OriginalWorker;
}

console.log('✅ PDF.js configured:', {
  disableWorker: pdfjs.GlobalWorkerOptions.disableWorker,
  workerSrc: pdfjs.GlobalWorkerOptions.workerSrc
});

import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
