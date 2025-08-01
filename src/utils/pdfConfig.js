import * as pdfjs from "pdfjs-dist";

/**
 * Centralized PDF.js configuration for Electron compatibility
 * 
 * SOLUTION: Worker is disabled at entry point (main.jsx)
 * This config is now just for loading options consistency.
 */

let isConfigured = false;

export function configurePdfJs() {
  if (isConfigured) return;
  
  if (typeof window !== 'undefined') {
    console.log('✅ PDF.js already configured at entry point');
    isConfigured = true;
  }
}

/**
 * Standard PDF loading options for Electron
 */
export const PDF_LOAD_OPTIONS = {
  cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
  cMapPacked: true,
  // Ensure worker is disabled at document level too
  useWorkerFetch: false,
  isEvalSupported: false,
};

// Auto-configure when module is imported
configurePdfJs();