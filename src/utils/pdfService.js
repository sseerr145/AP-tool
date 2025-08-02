/**
 * SINGLE PDF SERVICE - All PDF operations go through here
 * No more scattered imports or configurations
 */
import * as pdfjs from 'pdfjs-dist';

// Configure worker ONCE, here only
pdfjs.GlobalWorkerOptions.workerSrc = './pdf.worker.mjs';
console.log('🔧 PDF.js configured ONCE:', pdfjs.GlobalWorkerOptions.workerSrc);

/**
 * Load PDF for preview display
 */
export async function loadPdfForPreview(arrayBuffer) {
  console.log('📄 Loading PDF for preview');
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  return await loadingTask.promise;
}

/**
 * Load PDF for OCR processing
 */
export async function loadPdfForOCR(arrayBuffer) {
  console.log('🔍 Loading PDF for OCR');
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  return await loadingTask.promise;
}

/**
 * Convert PDF page to image for OCR
 */
export async function pdfPageToImage(pdfDoc, pageNumber = 1, scale = 3.0) {
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  
  canvas.height = viewport.height;
  canvas.width = viewport.width;
  
  const renderContext = {
    canvasContext: context,
    viewport: viewport,
  };
  
  await page.render(renderContext).promise;
  
  // Return image data for OCR
  return canvas.toDataURL("image/png");
}