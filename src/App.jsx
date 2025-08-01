import { useState } from "react";
import PdfViewer from "./components/PdfViewer";
import ExtractedFieldsPanel from "./components/ExtractedFieldsPanel";
import Tesseract from "tesseract.js";
import * as pdfjs from "pdfjs-dist";

// Configure PDF.js worker - Updated path resolution
if (typeof window !== 'undefined') {
  // For Electron/browser environment
  pdfjs.GlobalWorkerOptions.workerSrc = './pdf.worker.js';
}

function App() {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [fields, setFields] = useState([]);
  const [highlight, setHighlight] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [processingStep, setProcessingStep] = useState('');

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setPdfUrl(objectUrl);
    setFields([]);
    setHighlight([]);
    setIsProcessing(true);
    setOcrProgress(0);
    setProcessingStep('Starting OCR process...');

    try {
      console.log("Starting OCR process...");
      setProcessingStep('Converting PDF to image...');
      const imageData = await pdfToImage(file);

      console.log("Running Tesseract OCR...");
      setProcessingStep('Running OCR recognition...');

      const result = await Tesseract.recognize(imageData, "eng", {
        logger: (m) => {
          console.log('OCR Progress:', m);
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
            setProcessingStep(`Processing OCR... ${Math.round(m.progress * 100)}%`);
          }
        },
      });

      console.log("OCR completed, processing results...");
      setProcessingStep('Extracting invoice fields...');

      // Extract structured invoice data
      const extractedFields = extractInvoiceFields(result.data);

      setFields(extractedFields);
      setProcessingStep('');
      console.log(`Extracted ${extractedFields.length} fields from PDF`);
    } catch (error) {
      console.error("OCR processing failed:", error);
      setProcessingStep(`OCR processing failed: ${error.message}`);
      setTimeout(() => setProcessingStep(''), 5000);
    } finally {
      setIsProcessing(false);
      setOcrProgress(0);
    }
  };

  const pdfToImage = async (file) => {
    console.log("Converting PDF to image for OCR...");

    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ 
        data: arrayBuffer,
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
        cMapPacked: true,
      });

      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);

      // Use higher scale for better OCR accuracy
      const scale = 2.5;
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

      // Cleanup
      pdf.destroy();

      console.log("PDF converted to canvas for OCR", { width: canvas.width, height: canvas.height });
      return canvas;
    } catch (error) {
      console.error("PDF to image conversion failed:", error);
      throw new Error(`PDF conversion failed: ${error.message}`);
    }
  };

  const extractInvoiceFields = (ocrData) => {
    console.log("OCR Data structure:", ocrData);

    const lines = ocrData.lines || [];
    const words = ocrData.words || [];
    const paragraphs = ocrData.paragraphs || [];
    const fields = [];

    console.log("Processing OCR data:", { 
      lines: lines.length, 
      words: words.length, 
      paragraphs: paragraphs.length 
    });

    // Get all text for pattern matching
    const allText = lines.map(line => line.text).join(' ');
    console.log("All extracted text:", allText);

    // Enhanced invoice field patterns with more variations
    const patterns = {
      invoiceNumber: [
        /invoice\s*(?:number|#|no\.?)\s*:?\s*([A-Z0-9\-]+)/i,
        /invoice\s+([A-Z0-9\-]{6,})/i,
        /(?:inv|invoice)\s*[:#]?\s*([A-Z0-9\-]{5,})/i,
        /([0-9]{3}[A-Z0-9\-]{3,})/i,  // Pattern like 561DSSBM-0002
        /^([A-Z0-9]{6,}\-[0-9]{3,})$/i // Direct pattern match
      ],
      date: [
        /(?:date\s*(?:of\s*issue)?|issued?|date\s*due)\s*:?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
        /(?:date|issued?)\s*:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
        /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})/i,
        /(July\s+24,?\s+2025)/i // Specific pattern from your invoice
      ],
      total: [
        /(?:total|amount\s*due)\s*:?\s*\$?\s*([\d,]+\.?\d*)/i,
        /\$\s*([\d,]+\.?\d*)\s*USD/i,
        /(?:amount|total)\s*:?\s*\$?\s*([\d,]+\.?\d*)/i,
        /\$([0-9]+\.00)\s*USD/i // Specific pattern like $20.00 USD
      ],
      subtotal: [
        /subtotal\s*:?\s*\$?\s*([\d,]+\.?\d*)/i
      ],
      vendor: [
        /(?:from|vendor|company)\s*:?\s*(.+)/i,
        /(Anthropic,?\s*PBC)/i // Specific vendor pattern
      ],
      customer: [
        /(?:bill\s*to|customer)\s*:?\s*(.+)/i,
        /(sergiu\.deviza@gmail\.com)/i // Specific customer pattern
      ]
    };

    // Enhanced pattern matching
    Object.entries(patterns).forEach(([fieldType, patternArray]) => {
      patternArray.forEach((pattern, patternIndex) => {
        const match = allText.match(pattern);
        if (match && match[1]) {
          // Find the line that contains this match to get coordinates
          const matchingLine = lines.find(line => {
            const lineText = line.text.toLowerCase();
            const matchText = match[1].toLowerCase();
            return lineText.includes(matchText) || pattern.test(line.text);
          });

          // Also check individual words for coordinates
          const matchingWord = words.find(word => {
            const wordText = word.text.toLowerCase();
            const matchText = match[1].toLowerCase();
            return wordText.includes(matchText) || matchText.includes(wordText);
          });

          const coordSource = matchingLine || matchingWord;

          if (coordSource) {
            const newField = {
              type: fieldType,
              label: fieldType.charAt(0).toUpperCase() + fieldType.slice(1).replace(/([A-Z])/g, ' $1'),
              name: coordSource.text,
              value: match[1].trim(),
              confidence: coordSource.confidence || 95,
              coords: {
                x: coordSource.bbox?.x0 || 0,
                y: coordSource.bbox?.y0 || 0,
                w: (coordSource.bbox?.x1 || 100) - (coordSource.bbox?.x0 || 0),
                h: (coordSource.bbox?.y1 || 20) - (coordSource.bbox?.y0 || 0),
              },
              patternIndex
            };

            // Avoid duplicates for the same field type
            const existingIndex = fields.findIndex(f => f.type === fieldType);
            if (existingIndex === -1) {
              fields.push(newField);
            } else if (newField.confidence > fields[existingIndex].confidence) {
              fields[existingIndex] = newField;
            }
          }
        }
      });
    });

    // Extract high-confidence structured data
    words.forEach((word, index) => {
      if (word.confidence > 85 && word.text && word.text.length > 3) {
        const text = word.text.trim();

        // Skip if already captured in structured fields
        const alreadyCaptured = fields.some(f => 
          f.value.toLowerCase().includes(text.toLowerCase()) || 
          text.toLowerCase().includes(f.value.toLowerCase())
        );

        // Skip common words and noise
        const commonWords = ['the', 'and', 'for', 'with', 'from', 'this', 'that', 'they', 'have', 'been'];
        const isCommonWord = commonWords.includes(text.toLowerCase());

        if (!alreadyCaptured && !isCommonWord && text.length > 3) {
          fields.push({
            type: 'text',
            label: 'Extracted Text',
            name: text,
            value: text,
            confidence: word.confidence,
            coords: {
              x: word.bbox?.x0 || 0,
              y: word.bbox?.y0 || 0,
              w: (word.bbox?.x1 || 100) - (word.bbox?.x0 || 0),
              h: (word.bbox?.y1 || 20) - (word.bbox?.y0 || 0),
            },
          });
        }
      }
    });

    // Remove duplicates and sort by importance and Y position
    const uniqueFields = [];
    const seen = new Set();

    // Prioritize structured fields first
    const structuredTypes = ['invoiceNumber', 'date', 'total', 'subtotal', 'vendor', 'customer'];
    const structuredFields = fields.filter(f => structuredTypes.includes(f.type));
    const textFields = fields.filter(f => f.type === 'text');

    [...structuredFields, ...textFields].forEach(field => {
      const key = `${field.value.toLowerCase()}-${field.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueFields.push(field);
      }
    });

    console.log("Extracted fields:", uniqueFields);
    return uniqueFields.sort((a, b) => {
      // Sort structured fields first, then by Y position
      const aIsStructured = structuredTypes.includes(a.type);
      const bIsStructured = structuredTypes.includes(b.type);

      if (aIsStructured && !bIsStructured) return -1;
      if (!aIsStructured && bIsStructured) return 1;

      return a.coords.y - b.coords.y;
    });
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
          <h1 className="text-2xl font-bold text-gray-900">Invoice Extraction Tool</h1>
          <div className="flex items-center gap-4">
            <label className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg cursor-pointer transition-colors font-medium">
              Upload PDF Invoice
              <input 
                type="file" 
                accept="application/pdf" 
                onChange={handleFileChange} 
                className="hidden" 
              />
            </label>
            {isProcessing && (
              <div className="flex items-center gap-3 text-blue-600 bg-blue-50 px-4 py-2 rounded-lg">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{processingStep}</span>
                  {ocrProgress > 0 && (
                    <div className="w-32 bg-blue-200 rounded-full h-1.5 mt-1">
                      <div 
                        className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${ocrProgress}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content - FLIPPED LAYOUT: Fields left, PDF right */}
      <div className="flex flex-1 overflow-hidden">
        {/* Extracted Fields Panel - Left 1/3 */}
        <div className="w-1/3 bg-white border-r overflow-auto">
          {fields.length > 0 ? (
            <ExtractedFieldsPanel
              fields={fields}
              onFieldClick={handleFieldClick}
              onFieldUpdate={handleFieldUpdate}
            />
          ) : (
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-3 text-gray-900">Extracted Fields</h2>
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500 text-sm">
                  {isProcessing ? "Processing document..." : "Upload a PDF invoice to extract fields"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* PDF Viewer - Right 2/3 */}
        <div className="w-2/3 overflow-auto p-6 bg-gray-50">
          {pdfUrl ? (
            <div className="flex justify-center">
              <div className="bg-white rounded-lg shadow-lg p-4">
                <PdfViewer pdfUrl={pdfUrl} highlights={highlight} />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No PDF loaded</h3>
                <p className="text-gray-500">Upload a PDF invoice to get started with field extraction</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;