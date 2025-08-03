import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker - use the existing setup
pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.mjs';

/**
 * Convert PDF to images for OCR processing
 */
const pdfToImages = async (file) => {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    
    fileReader.onload = async function() {
      try {
        const typedArray = new Uint8Array(this.result);
        const pdf = await pdfjsLib.getDocument(typedArray).promise;
        const images = [];
        
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR
          
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise;
          
          // Convert canvas to image data
          const imageData = canvas.toDataURL('image/png');
          images.push(imageData);
        }
        
        resolve(images);
      } catch (error) {
        reject(error);
      }
    };
    
    fileReader.onerror = () => reject(new Error('Failed to read PDF file'));
    fileReader.readAsArrayBuffer(file);
  });
};

/**
 * Extract text from images using Tesseract.js
 */
const extractTextFromImages = async (images, onProgress) => {
  let allText = '';
  
  for (let i = 0; i < images.length; i++) {
    try {
      const result = await Tesseract.recognize(
        images[i],
        'eng', // English only as requested
        {
          logger: (m) => {
            if (onProgress) {
              const progress = ((i / images.length) + (m.progress / images.length)) * 100;
              onProgress(Math.round(progress));
            }
          }
        }
      );
      
      allText += result.data.text + '\n';
    } catch (error) {
      console.error(`Error processing page ${i + 1}:`, error);
    }
  }
  
  return allText;
};

/**
 * Extract invoice number from text
 */
const extractInvoiceNumber = (text) => {
  const patterns = [
    /invoice\s*#?\s*:?\s*([A-Z0-9\-\/]+)/i,
    /inv\s*#?\s*:?\s*([A-Z0-9\-\/]+)/i,
    /invoice\s*number\s*:?\s*([A-Z0-9\-\/]+)/i,
    /bill\s*#?\s*:?\s*([A-Z0-9\-\/]+)/i,
    /#\s*([A-Z0-9\-\/]{3,})/i,
    /([0-9]{3,}[A-Z0-9\-\/]{3,})/i,  // Pattern like 561DSSBM-0002
    /^([A-Z0-9]{4,}\-?[0-9]{2,})$/im // Direct pattern match
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return null;
};

/**
 * Extract date from text
 */
const extractDate = (text) => {
  const patterns = [
    /date\s*:?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /invoice\s*date\s*:?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /bill\s*date\s*:?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/g,
    /(\d{4}-\d{2}-\d{2})/g,
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}/i,
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4}/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const dateStr = match[1].trim();
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
      }
    }
  }
  
  return null;
};

/**
 * Extract vendor/company name from text
 */
const extractVendor = (text) => {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Common patterns for vendor names
  const patterns = [
    /bill\s*to\s*:?\s*(.+)/i,
    /vendor\s*:?\s*(.+)/i,
    /company\s*:?\s*(.+)/i,
    /from\s*:?\s*(.+)/i
  ];
  
  for (const pattern of patterns) {
    for (const line of lines) {
      const match = line.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  }
  
  // If no pattern matches, try to find company-like names in the first few lines
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i];
    // Look for lines that might be company names (contain letters and possibly common business words)
    if (line.length > 3 && line.length < 50 && /[a-zA-Z]/.test(line) && 
        (line.includes('Inc') || line.includes('LLC') || line.includes('Corp') || 
         line.includes('Ltd') || line.includes('Co') || /^[A-Z][a-z\s&]+$/.test(line))) {
      return line;
    }
  }
  
  return null;
};

/**
 * Extract total amount from text
 */
const extractAmount = (text) => {
  const patterns = [
    /total\s*:?\s*\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,
    /amount\s*due\s*:?\s*\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,
    /balance\s*due\s*:?\s*\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,
    /grand\s*total\s*:?\s*\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,
    /subtotal\s*:?\s*\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,
    /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:USD|usd)?/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  // Look for currency amounts in the text
  const currencyPattern = /\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g;
  const amounts = [];
  let match;
  
  while ((match = currencyPattern.exec(text)) !== null) {
    amounts.push(parseFloat(match[1].replace(/,/g, '')));
  }
  
  if (amounts.length > 0) {
    // Return the largest amount (likely to be the total)
    return Math.max(...amounts).toFixed(2);
  }
  
  return null;
};

/**
 * Extract line items from text
 */
const extractLineItems = (text) => {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const items = [];
  
  for (const line of lines) {
    // Look for lines that contain both description and amount
    const itemPattern = /(.+?)\s+\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)$/;
    const match = line.match(itemPattern);
    
    if (match && match[1] && match[2]) {
      const description = match[1].trim();
      const amount = match[2];
      
      // Filter out lines that are likely headers or totals
      if (description.length > 3 && description.length < 100 &&
          !description.toLowerCase().includes('total') &&
          !description.toLowerCase().includes('subtotal') &&
          !description.toLowerCase().includes('tax') &&
          !description.toLowerCase().includes('amount due')) {
        items.push({
          description,
          amount
        });
      }
    }
  }
  
  return items;
};

/**
 * Main OCR processing function for Electron
 */
export const performOCR = async (file, onProgress) => {
  try {
    console.log('🔍 Starting OCR processing...');
    
    // Convert PDF to images
    onProgress && onProgress(10);
    const images = await pdfToImages(file);
    console.log(`📸 Converted PDF to ${images.length} images`);
    
    // Extract text from images
    onProgress && onProgress(20);
    const extractedText = await extractTextFromImages(images, (progress) => {
      onProgress && onProgress(20 + (progress * 0.6)); // 20% to 80%
    });
    
    console.log('📝 Extracted text length:', extractedText.length);
    
    // Extract structured data
    onProgress && onProgress(85);
    const invoiceData = {
      invoiceNumber: extractInvoiceNumber(extractedText),
      invoiceDate: extractDate(extractedText),
      vendorName: extractVendor(extractedText),
      totalAmount: extractAmount(extractedText),
      lineItems: extractLineItems(extractedText),
      rawText: extractedText // For debugging
    };
    
    console.log('🎯 Extracted invoice data:', invoiceData);
    onProgress && onProgress(100);
    return invoiceData;
    
  } catch (error) {
    console.error('❌ OCR Processing Error:', error);
    throw new Error('Failed to process invoice: ' + error.message);
  }
};