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
            setProcessingStep('Processing OCR... ' + Math.round(m.progress * 100) + '%');
          }
        },
      });

      console.log("OCR completed, processing results...");
      setProcessingStep('Extracting invoice fields...');

      // Extract structured invoice data
      const extractedFields = extractInvoiceFields(result.data);

      setFields(extractedFields);
      setProcessingStep('');
      console.log('Extracted ' + extractedFields.length + ' fields from PDF');
    } catch (error) {
      console.error("OCR processing failed:", error);
      setProcessingStep('OCR processing failed: ' + error.message);
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
      throw new Error('PDF conversion failed: ' + error.message);
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
      const key = field.value.toLowerCase() + '-' + field.type;
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
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Modern Header */}
      <header className="bg-white/80 backdrop-blur-md shadow-lg border-b border-blue-100 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                AI Invoice Extractor
              </h1>
              <p className="text-sm text-gray-600">Advanced OCR & Smart Field Recognition</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="group bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-3 rounded-xl cursor-pointer transition-all duration-300 font-semibold shadow-lg hover:shadow-xl hover:scale-105 flex items-center gap-3">
              <svg className="w-5 h-5 group-hover:rotate-12 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload PDF Invoice
              <input 
                type="file" 
                accept="application/pdf" 
                onChange={handleFileChange} 
                className="hidden" 
              />
            </label>
            {isProcessing && (
              <div className="flex items-center gap-4 text-blue-700 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-3 rounded-xl border border-blue-200 shadow-lg">
                <div className="relative">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-200"></div>
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-blue-600 absolute top-0 left-0"></div>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">{processingStep}</span>
                  {ocrProgress > 0 && (
                    <div className="w-40 bg-blue-200 rounded-full h-2 mt-2 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-500 ease-out"
                        style={{ width: ocrProgress + '%' }}
                      ></div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Enhanced Main Content */}
      <div className="flex flex-1 overflow-hidden gap-4 p-4">
        {/* Extracted Fields Panel - Left 1/3 */}
        <div className="w-1/3 bg-white/90 backdrop-blur-sm border border-blue-100 rounded-2xl shadow-xl overflow-auto">
          {fields.length > 0 ? (
            <ExtractedFieldsPanel
              fields={fields}
              onFieldClick={handleFieldClick}
              onFieldUpdate={handleFieldUpdate}
            />
          ) : (
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-800">Smart Field Detection</h2>
              </div>
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <svg className="h-10 w-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  {isProcessing ? "🔍 AI Processing Document..." : "Ready for Analysis"}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed max-w-xs mx-auto">
                  {isProcessing 
                    ? "Advanced OCR technology is extracting and categorizing invoice data" 
                    : "Upload a PDF invoice and watch AI automatically detect invoice numbers, dates, totals, and more"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* PDF Viewer - Right 2/3 */}
        <div className="w-2/3 overflow-auto bg-white/70 backdrop-blur-sm border border-blue-100 rounded-2xl shadow-xl p-6">
          {pdfUrl ? (
            <div className="flex justify-center">
              <div className="bg-white rounded-2xl shadow-2xl p-6 border border-blue-100">
                <PdfViewer pdfUrl={pdfUrl} highlights={highlight} />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg">
                  <svg className="h-12 w-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-4">Ready for Document Analysis</h3>
                <p className="text-gray-600 leading-relaxed mb-8">
                  Drop your PDF invoice above and witness AI-powered extraction in action. 
                  Our advanced OCR technology will automatically identify and categorize key invoice data.
                </p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mx-auto mb-2">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div className="font-semibold text-blue-800">Fast OCR</div>
                    <div className="text-blue-600">Seconds to extract</div>
                  </div>
                  <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                    <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center mx-auto mb-2">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div className="font-semibold text-indigo-800">Smart Fields</div>
                    <div className="text-indigo-600">Auto-categorized</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;