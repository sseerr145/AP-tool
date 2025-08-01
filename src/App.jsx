import { useState } from "react";
import PdfViewer from "./components/PdfViewer";
import ExtractedFieldsPanel from "./components/ExtractedFieldsPanel";
import Tesseract from "tesseract.js";
import * as pdfjs from "pdfjs-dist";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = './pdf.worker.js';

function App() {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [fields, setFields] = useState([]);
  const [highlight, setHighlight] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setPdfUrl(objectUrl);
    setFields([]);
    setHighlight([]);
    setIsProcessing(true);
    setOcrProgress(0);

    try {
      console.log("Starting OCR process...");
      const imageData = await pdfToImage(file);
      
      console.log("Running Tesseract OCR...");
      const result = await Tesseract.recognize(imageData, "eng", {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        },
      });

      console.log("OCR completed, processing results...");
      
      // Extract structured invoice data
      const extractedFields = extractInvoiceFields(result.data);
      
      setFields(extractedFields);
      console.log(`Extracted ${extractedFields.length} fields from PDF`);
    } catch (error) {
      console.error("OCR processing failed:", error);
      alert(`OCR processing failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setOcrProgress(0);
    }
  };

  const pdfToImage = async (file) => {
    console.log("Converting PDF to image for OCR...");
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    
    // Use higher scale for better OCR accuracy
    const scale = 3;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport }).promise;
    
    // Cleanup
    pdf.destroy();
    
    console.log("PDF converted to canvas for OCR");
    return canvas;
  };

  const extractInvoiceFields = (ocrData) => {
    const lines = ocrData.lines || [];
    const words = ocrData.words || [];
    const fields = [];
    
    console.log("Processing OCR data:", { lines: lines.length, words: words.length });
    
    // Get all text for pattern matching
    const allText = lines.map(line => line.text).join(' ');
    console.log("All extracted text:", allText);
    
    // Enhanced invoice field patterns
    const patterns = {
      invoiceNumber: [
        /invoice\s*(?:number|#|no\.?)\s*:?\s*([A-Z0-9\-]+)/i,
        /invoice\s+([A-Z0-9\-]{6,})/i,
        /(?:inv|invoice)\s*[:#]?\s*([A-Z0-9\-]{5,})/i,
        /([0-9]{3}[A-Z0-9\-]{5,})/i  // Pattern like 561DSSBM-0002
      ],
      date: [
        /(?:date\s*(?:of\s*issue)?|issued?)\s*:?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
        /(?:date|issued?)\s*:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
        /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})/i
      ],
      total: [
        /(?:total|amount\s*due)\s*:?\s*\$?\s*([\d,]+\.?\d*)/i,
        /\$\s*([\d,]+\.?\d*)\s*USD/i,
        /(?:amount|total)\s*:?\s*\$?\s*([\d,]+\.?\d*)/i
      ],
      subtotal: [
        /subtotal\s*:?\s*\$?\s*([\d,]+\.?\d*)/i
      ],
      vendor: [
        /(?:from|vendor|company)\s*:?\s*(.+)/i
      ],
      customer: [
        /(?:bill\s*to|customer)\s*:?\s*(.+)/i
      ]
    };

    // First, try to match patterns in the full text
    Object.entries(patterns).forEach(([fieldType, patternArray]) => {
      patternArray.forEach(pattern => {
        const match = allText.match(pattern);
        if (match && match[1]) {
          // Find the line that contains this match to get coordinates
          const matchingLine = lines.find(line => 
            line.text.toLowerCase().includes(match[1].toLowerCase()) ||
            pattern.test(line.text)
          );
          
          if (matchingLine) {
            fields.push({
              type: fieldType,
              label: fieldType.charAt(0).toUpperCase() + fieldType.slice(1).replace(/([A-Z])/g, ' $1'),
              name: matchingLine.text,
              value: match[1].trim(),
              confidence: matchingLine.confidence || 95,
              coords: {
                x: matchingLine.bbox?.x0 || 0,
                y: matchingLine.bbox?.y0 || 0,
                w: (matchingLine.bbox?.x1 || 0) - (matchingLine.bbox?.x0 || 0),
                h: (matchingLine.bbox?.y1 || 0) - (matchingLine.bbox?.y0 || 0),
              },
            });
          }
        }
      });
    });

    // Also extract high-confidence words as potential fields
    words.forEach(word => {
      if (word.confidence > 80 && word.text && word.text.length > 2) {
        const text = word.text.trim();
        
        // Skip if already captured
        const alreadyCaptured = fields.some(f => 
          f.value.includes(text) || text.includes(f.value)
        );
        
        if (!alreadyCaptured) {
          fields.push({
            type: 'text',
            label: 'Extracted Text',
            name: text,
            value: text,
            confidence: word.confidence,
            coords: {
              x: word.bbox?.x0 || 0,
              y: word.bbox?.y0 || 0,
              w: (word.bbox?.x1 || 0) - (word.bbox?.x0 || 0),
              h: (word.bbox?.y1 || 0) - (word.bbox?.y0 || 0),
            },
          });
        }
      }
    });

    // Remove duplicates and sort by Y position
    const uniqueFields = fields.filter((field, index, self) => 
      index === self.findIndex(f => f.value === field.value)
    );
    
    console.log("Extracted fields:", uniqueFields);
    return uniqueFields.sort((a, b) => a.coords.y - b.coords.y);
  };

  const handleFieldClick = (field) => {
    setHighlight([field.coords]);
  };

  const handleFieldUpdate = (index, newField) => {
    const updated = [...fields];
    updated[index] = newField;
    setFields(updated);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Invoice Extraction Tool</h1>
          <div className="flex items-center gap-4">
            <label className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded cursor-pointer transition-colors">
              Upload PDF Invoice
              <input 
                type="file" 
                accept="application/pdf" 
                onChange={handleFileChange} 
                className="hidden" 
              />
            </label>
            {isProcessing && (
              <div className="flex items-center gap-2 text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm">Processing OCR... {ocrProgress}%</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* PDF Viewer - Left 2/3 */}
        <div className="w-2/3 overflow-auto p-4 bg-white border-r">
          {pdfUrl ? (
            <div className="flex justify-center">
              <PdfViewer pdfUrl={pdfUrl} highlights={highlight} />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No PDF loaded</h3>
                <p className="mt-1 text-sm text-gray-500">Upload a PDF invoice to get started</p>
              </div>
            </div>
          )}
        </div>

        {/* Extracted Fields Panel - Right 1/3 */}
        <div className="w-1/3 bg-gray-100 overflow-auto">
          {fields.length > 0 ? (
            <ExtractedFieldsPanel
              fields={fields}
              onFieldClick={handleFieldClick}
              onFieldUpdate={handleFieldUpdate}
            />
          ) : (
            <div className="p-4">
              <h2 className="text-lg font-semibold mb-2">Extracted Fields</h2>
              <p className="text-gray-500 text-sm">
                {isProcessing ? "Processing document..." : "Upload a PDF to see extracted fields"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;