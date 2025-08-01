import { useState } from "react";
import PdfViewer from "./components/PdfViewer";
import ExtractedFieldsPanel from "./components/ExtractedFieldsPanel";
import Tesseract from "tesseract.js";

function App() {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [fields, setFields] = useState([]);
  const [highlight, setHighlight] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setPdfUrl(objectUrl);
    setFields([]);
    setHighlight([]);
    setIsProcessing(true);

    // Add a small delay to let the PDF viewer load first
    setTimeout(async () => {
      try {
        console.log("Starting OCR process...");
        const imageBitmap = await pdfToImage(file);
        
        console.log("Running Tesseract OCR...");
        const result = await Tesseract.recognize(imageBitmap, "eng", {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
            }
          },
        });

        console.log("OCR completed, processing results...");
        console.log("Raw OCR data:", result.data);

        const words = result.data?.words || [];
        console.log("Total words found:", words.length);
        
        const cleaned = words
          .filter(w => {
            const hasText = w.text && w.text.trim().length > 0;
            const hasValidBbox = w.bbox && typeof w.bbox.x0 === 'number';
            return hasText && hasValidBbox;
          })
          .map((w) => ({
            name: w.text.trim(),
            confidence: w.confidence,
            coords: {
              x: w.bbox.x0,
              y: w.bbox.y0,
              w: w.bbox.x1 - w.bbox.x0,
              h: w.bbox.y1 - w.bbox.y0,
            },
          }));
        
        console.log("Words after filtering:", cleaned.length);

        console.log(`Extracted ${cleaned.length} fields from PDF`);
        setFields(cleaned);
      } catch (error) {
        console.error("OCR processing failed:", error);
        alert(`OCR processing failed: ${error.message}`);
      } finally {
        setIsProcessing(false);
      }
    }, 1000); // Give PDF viewer time to load first
  };

  const pdfToImage = async (file) => {
    const pdfjsLib = await import("pdfjs-dist");
    
    console.log("Converting PDF to image for OCR...");
    const pdf = await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
    const page = await pdf.getPage(1);
    const scale = 2;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport }).promise;
    console.log("PDF converted to canvas for OCR");
    return canvas;
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
                <span className="text-sm">Processing OCR...</span>
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