import { useState, useCallback } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, Download, Eye, EyeOff, Loader2, Copy, FileCheck, Globe } from 'lucide-react';
import PdfViewer from "./components/PdfViewer";
import ExtractedFieldsPanel from "./components/ExtractedFieldsPanel";
import Tesseract from "tesseract.js";
import { loadPdfForOCR, pdfPageToImage } from "./utils/pdfService";

function App() {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [fields, setFields] = useState([]);
  const [highlight, setHighlight] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [processingStep, setProcessingStep] = useState('');
  const [ocrLanguage, setOcrLanguage] = useState('eng'); // Default to English
  const [dragActive, setDragActive] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showRawText, setShowRawText] = useState(false);
  const [error, setError] = useState('');
  const [rawOcrText, setRawOcrText] = useState('');

  // Preset invoice fields structure
  const [invoiceData, setInvoiceData] = useState({
    invoiceNumber: { value: '', confidence: 0, found: false },
    date: { value: '', confidence: 0, found: false },
    dueDate: { value: '', confidence: 0, found: false },
    total: { value: '', confidence: 0, found: false },
    subtotal: { value: '', confidence: 0, found: false },
    tax: { value: '', confidence: 0, found: false },
    vendor: { value: '', confidence: 0, found: false },
    customer: { value: '', confidence: 0, found: false }
  });

  // Enhanced drag & drop handlers
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const [pdfFile, setPdfFile] = useState(null); // Store actual file, not URL

  const handleFile = async (file) => {
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }
    
    console.log('File selected:', file.name, (file.size / 1024 / 1024).toFixed(2) + ' MB');
    
    // Store ONLY the file - we'll create fresh ArrayBuffers when needed
    setPdfFile(file);
    setPdfUrl(file); // Pass the file directly, not ArrayBuffer
    
    setFields([]);
    setHighlight([]);
    setError('');
  };

  const extractInvoiceData = async () => {
    if (!pdfFile) return;

    setIsProcessing(true);
    setOcrProgress(0);
    setProcessingStep('Starting OCR process...');

    try {
      console.log("Starting OCR process...");
      setProcessingStep('Converting PDF to image...');
      
      // Use the stored file directly (no more URL conversion needed)
      const imageData = await pdfToImage(pdfFile);

      console.log("Running Tesseract OCR...");
      setProcessingStep('Running OCR recognition...');

      const result = await Tesseract.recognize(imageData, ocrLanguage, {
        logger: (m) => {
          console.log('OCR Progress:', m);
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
            setProcessingStep('Processing OCR... ' + Math.round(m.progress * 100) + '%');
          }
        },
        // Enhanced OCR settings for scanned documents
        tessedit_pageseg_mode: '1', // Automatic page segmentation with OSD
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,;:!?()[]{}+-=$#@%&*/', // Common invoice characters
        tessedit_ocr_engine_mode: '2', // Use both legacy and LSTM OCR engine
        preserve_interword_spaces: '1', // Preserve spaces between words
        user_defined_dpi: '300', // Higher DPI for better accuracy on scanned docs
      });

      console.log("OCR completed, processing results...");
      setProcessingStep('Extracting invoice fields...');

      // Store the raw OCR text
      const fullText = result.data.text || '';
      setRawOcrText(fullText);

      // Extract structured invoice data
      const extractedFields = extractInvoiceFields(result.data);

      setFields(extractedFields);
      setProcessingStep('');
      console.log('Extracted ' + extractedFields.length + ' fields from PDF');
      
      // Update structured invoice data
      const newInvoiceData = { ...invoiceData };
      extractedFields.forEach(field => {
        if (field.type && newInvoiceData[field.type]) {
          newInvoiceData[field.type] = {
            value: field.value,
            confidence: field.confidence,
            found: true
          };
        }
      });
      setInvoiceData(newInvoiceData);
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
      // Create fresh ArrayBuffer for OCR to avoid detachment issues
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await loadPdfForOCR(arrayBuffer);
      
      // Use service to convert to image
      const imageDataUrl = await pdfPageToImage(pdf, 1, 3.0);
      
      // Convert data URL to canvas for preprocessing
      const img = new Image();
      img.src = imageDataUrl;
      
      return new Promise((resolve) => {
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          canvas.width = img.width;
          canvas.height = img.height;
          context.drawImage(img, 0, 0);
          
          // Enhanced preprocessing for scanned documents
          const preprocessedCanvas = preprocessImageForOCR(canvas);
          
          // Cleanup
          pdf.destroy();
          
          console.log("PDF converted and preprocessed for OCR", { 
            width: preprocessedCanvas.width, 
            height: preprocessedCanvas.height 
          });
          resolve(preprocessedCanvas);
        };
      });
    } catch (error) {
      console.error("PDF to image conversion failed:", error);
      throw new Error('PDF conversion failed: ' + error.message);
    }
  };

  const preprocessImageForOCR = (canvas) => {
    const context = canvas.getContext('2d');
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Apply preprocessing for better OCR on scanned documents
    for (let i = 0; i < data.length; i += 4) {
      // Convert to grayscale first
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      
      // Apply contrast enhancement and noise reduction
      let enhanced = gray;
      
      // Increase contrast for faded scans
      enhanced = Math.round(((enhanced - 128) * 1.2) + 128);
      
      // Apply threshold for better text detection (adaptive based on average)
      if (enhanced < 140) {
        enhanced = Math.max(0, enhanced - 20); // Darken text
      } else {
        enhanced = Math.min(255, enhanced + 20); // Brighten background
      }
      
      // Set RGB to the enhanced value
      data[i] = enhanced;     // Red
      data[i + 1] = enhanced; // Green
      data[i + 2] = enhanced; // Blue
      // Alpha stays the same (data[i + 3])
    }

    // Create new canvas with preprocessed image
    const preprocessedCanvas = document.createElement("canvas");
    const preprocessedContext = preprocessedCanvas.getContext("2d");
    preprocessedCanvas.width = canvas.width;
    preprocessedCanvas.height = canvas.height;
    
    preprocessedContext.putImageData(imageData, 0, 0);
    
    console.log("Image preprocessing completed for better OCR accuracy");
    return preprocessedCanvas;
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

    // Enhanced invoice field patterns optimized for scanned documents
    const patterns = {
      invoiceNumber: [
        /invoice\s*(?:number|#|no\.?|num\.?)\s*:?\s*([A-Z0-9\-\/]{3,})/i,
        /invoice\s+([A-Z0-9\-\/]{5,})/i,
        /(?:inv|invoice)\s*[:#]?\s*([A-Z0-9\-\/]{4,})/i,
        /(?:bill|receipt)\s*(?:number|#|no\.?)\s*:?\s*([A-Z0-9\-\/]{3,})/i,
        /([0-9]{3,}[A-Z0-9\-\/]{3,})/i,  // Pattern like 561DSSBM-0002
        /^([A-Z0-9]{4,}\-?[0-9]{2,})$/i, // Direct pattern match
        /(?:order|ord|po)\s*(?:number|#|no\.?)\s*:?\s*([A-Z0-9\-\/]{3,})/i, // Purchase order numbers
      ],
      date: [
        /(?:date\s*(?:of\s*issue)?|issued?|invoice\s*date|bill\s*date)\s*:?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
        /(?:date|issued?|created?|billed?)\s*:?\s*(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4})/i,
        /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})/i,
        /(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{4})/i, // Generic date pattern
        /(\d{4}[-\/\.]\d{1,2}[-\/\.]\d{1,2})/i, // ISO date format
        /(?:on|dated?)\s*:?\s*(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4})/i,
      ],
      total: [
        /(?:total|amount\s*due|balance\s*due|grand\s*total)\s*:?\s*\$?\s*([\d,]+\.?\d*)/i,
        /\$\s*([\d,]+\.?\d*)\s*(?:USD|usd)?/i,
        /(?:amount|total|sum)\s*:?\s*\$?\s*([\d,]+\.?\d*)/i,
        /(?:due|owing|payable)\s*:?\s*\$?\s*([\d,]+\.?\d*)/i,
        /\$\s*([0-9]+\.?[0-9]*)\s*(?:USD|usd|total|due)?/i,
        /(?:pay|payment)\s*(?:amount)?\s*:?\s*\$?\s*([\d,]+\.?\d*)/i,
        /([\d,]+\.?\d+)\s*(?:USD|usd|dollars?)/i, // Number followed by currency
      ],
      subtotal: [
        /(?:sub\s*total|subtotal|sub-total)\s*:?\s*\$?\s*([\d,]+\.?\d*)/i,
        /(?:before\s*tax|pre\s*tax)\s*:?\s*\$?\s*([\d,]+\.?\d*)/i,
        /(?:net|amount)\s*:?\s*\$?\s*([\d,]+\.?\d*)/i,
      ],
      tax: [
        /(?:tax|vat|gst|hst|sales\s*tax)\s*:?\s*\$?\s*([\d,]+\.?\d*)/i,
        /(?:tax\s*amount|tax\s*total)\s*:?\s*\$?\s*([\d,]+\.?\d*)/i,
        /([\d,]+\.?\d*)\s*%?\s*(?:tax|vat)/i,
      ],
      vendor: [
        /(?:from|vendor|company|supplier|billed?\s*by)\s*:?\s*(.+)/i,
        /(?:invoice\s*from|bill\s*from)\s*:?\s*(.+)/i,
        /(?:sold\s*by|provided\s*by)\s*:?\s*(.+)/i,
      ],
      customer: [
        /(?:bill\s*to|customer|client|sold\s*to|ship\s*to)\s*:?\s*(.+)/i,
        /(?:billed\s*to|invoice\s*to)\s*:?\s*(.+)/i,
        /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i, // Email addresses
      ],
      dueDate: [
        /(?:due\s*date|payment\s*due|pay\s*by)\s*:?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
        /(?:due\s*date|payment\s*due)\s*:?\s*(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4})/i,
        /(?:payable\s*by|due\s*by)\s*:?\s*(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4})/i,
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

            // Avoid duplicates for the same field type, with confidence filtering
            const existingIndex = fields.findIndex(f => f.type === fieldType);
            if (existingIndex === -1) {
              // Only add fields with reasonable confidence for scanned documents
              if (newField.confidence >= 70) {
                fields.push(newField);
              }
            } else if (newField.confidence > fields[existingIndex].confidence && newField.confidence >= 70) {
              fields[existingIndex] = newField;
            }
          }
        }
      });
    });

    // Extract high-confidence structured data with enhanced filtering for scanned documents
    words.forEach((word, index) => {
      // Higher confidence threshold for scanned documents (was 85, now 80)
      if (word.confidence > 80 && word.text && word.text.length > 2) {
        const text = word.text.trim();
        
        // Enhanced noise filtering for scanned documents
        const isValidText = /^[A-Za-z0-9\-\.\,\$\@\#\%\&\+\=\_\:\;\/\\]+$/.test(text);
        const hasMinimumLetters = (text.match(/[A-Za-z]/g) || []).length >= 1;
        
        if (!isValidText || !hasMinimumLetters) {
          return; // Skip invalid characters from OCR errors
        }

        // Skip if already captured in structured fields
        const alreadyCaptured = fields.some(f => 
          f.value.toLowerCase().includes(text.toLowerCase()) || 
          text.toLowerCase().includes(f.value.toLowerCase())
        );

        // Enhanced common words and noise filtering for scanned documents
        const commonWords = [
          'the', 'and', 'for', 'with', 'from', 'this', 'that', 'they', 'have', 'been',
          'are', 'was', 'will', 'can', 'may', 'shall', 'should', 'would', 'could',
          'page', 'www', 'com', 'net', 'org', 'http', 'https', 'pdf', 'doc'
        ];
        const isCommonWord = commonWords.includes(text.toLowerCase());
        
        // Skip very short words that are likely OCR errors
        const isTooShort = text.length < 3;
        
        // Skip words that are mostly numbers (unless they look like amounts or dates)
        const isMostlyNumbers = /^[0-9\.\,\-\/]{2,}$/.test(text) && 
                               !text.match(/\$/) && 
                               !(text.match(/^\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}$/)); // Skip unless it's a date

        if (!alreadyCaptured && !isCommonWord && !isTooShort && !isMostlyNumbers) {
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

  // Enhanced export and clipboard functions
  const copyToClipboard = async () => {
    if (!fields.length) return;
    
    const exportData = generateExportData();
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const downloadJSON = () => {
    if (!fields.length) return;
    
    const exportData = generateExportData();
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // Enhanced filename with timestamp
    const invoiceNumber = fields.find(f => f.type === 'invoiceNumber')?.value || 'extracted';
    const timestamp = new Date().toISOString().split('T')[0];
    a.download = `invoice_${invoiceNumber}_${timestamp}.json`;
    
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateExportData = () => {
    const structuredFields = fields.filter(f => f.type !== 'text');
    const textFields = fields.filter(f => f.type === 'text');

    const exportData = {
      invoice: {},
      extraction_metadata: {
        total_fields: fields.length,
        extraction_date: new Date().toISOString(),
        average_confidence: Math.round(fields.reduce((acc, f) => acc + f.confidence, 0) / fields.length),
        ocr_language: ocrLanguage
      }
    };

    // Convert structured fields to a more comprehensive format
    structuredFields.forEach(field => {
      exportData.invoice[field.type] = {
        value: field.value || field.name,
        confidence: field.confidence,
        coordinates: field.coords
      };
    });

    // Add additional text if available
    if (textFields.length > 0) {
      exportData.additional_text = textFields.map(field => ({
        text: field.value,
        confidence: field.confidence,
        coordinates: field.coords
      }));
    }

    return exportData;
  };

  const resetUpload = () => {
    setPdfUrl(null);
    setFields([]);
    setHighlight([]);
    setError('');
    setShowRawText(false);
    setRawOcrText('');
    setInvoiceData({
      invoiceNumber: { value: '', confidence: 0, found: false },
      date: { value: '', confidence: 0, found: false },
      dueDate: { value: '', confidence: 0, found: false },
      total: { value: '', confidence: 0, found: false },
      subtotal: { value: '', confidence: 0, found: false },
      tax: { value: '', confidence: 0, found: false },
      vendor: { value: '', confidence: 0, found: false },
      customer: { value: '', confidence: 0, found: false }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Enhanced Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-indigo-100 rounded-full">
              <FileCheck className="w-12 h-12 text-indigo-600" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            ✨ AI Invoice Extractor
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Upload your PDF invoice and let AI-powered OCR extract all the key information automatically
          </p>
          <div className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-500">
            <Globe className="w-4 h-4" />
            <span>Multi-language support • Enhanced for scanned documents</span>
          </div>
        </div>

        {/* Enhanced Upload Section */}
        <div className="bg-white rounded-3xl shadow-xl p-8 mb-8 border border-gray-100">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <h2 className="text-2xl font-semibold text-gray-800">Upload Invoice</h2>
            <div className="flex items-center gap-4">
              {/* Language Selection */}
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-gray-500" />
                <select 
                  value={ocrLanguage} 
                  onChange={(e) => setOcrLanguage(e.target.value)}
                  className="bg-white border-2 border-indigo-200 text-gray-700 px-3 py-2 rounded-lg font-medium hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-300 text-sm"
                >
                  <option value="eng">English</option>
                  <option value="spa">Español</option>
                  <option value="fra">Français</option>
                  <option value="deu">Deutsch</option>
                  <option value="ita">Italiano</option>
                  <option value="por">Português</option>
                  <option value="nld">Nederlands</option>
                  <option value="rus">Русский</option>
                  <option value="chi_sim">中文 (简体)</option>
                  <option value="jpn">日本語</option>
                </select>
              </div>
            </div>
          </div>
          
          <div
            className={`relative border-3 border-dashed rounded-2xl p-8 md:p-16 text-center transition-all duration-300 ${
              dragActive 
                ? 'border-indigo-500 bg-indigo-50 scale-105' 
                : 'border-gray-300 hover:border-gray-400 bg-gray-50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className={`w-20 h-20 mx-auto mb-6 transition-colors ${
              dragActive ? 'text-indigo-500' : 'text-gray-400'
            }`} />
            <p className="text-2xl mb-2 text-gray-700 font-medium">
              {dragActive ? 'Drop your PDF here' : 'Drag & Drop your PDF invoice'}
            </p>
            <p className="text-gray-500 mb-6">or</p>
            <label className="inline-flex items-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-xl cursor-pointer hover:bg-indigo-700 transition-all transform hover:scale-105 shadow-lg">
              <FileText className="w-5 h-5" />
              Browse Files
              <input
                type="file"
                className="hidden"
                accept=".pdf"
                onChange={handleFileChange}
              />
            </label>
            <p className="text-sm text-gray-500 mt-4">Supported format: PDF (Max 10MB) • Works with scanned documents</p>
          </div>

          {/* File Info Section */}
          {pdfUrl && (
            <div className="mt-6 p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <FileText className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-green-800 font-semibold">PDF Ready for Processing</p>
                    <p className="text-green-600 text-sm">File uploaded successfully</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={resetUpload}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Change File
                  </button>
                  <button
                    onClick={extractInvoiceData}
                    disabled={isProcessing}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg transform hover:scale-105"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Extract Data
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              {/* Processing Progress */}
              {isProcessing && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-200"></div>
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-blue-600 absolute top-0 left-0"></div>
                    </div>
                    <span className="text-blue-800 font-medium">{processingStep}</span>
                  </div>
                  {ocrProgress > 0 && (
                    <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-500 ease-out"
                        style={{ width: ocrProgress + '%' }}
                      ></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <span className="text-red-800">{error}</span>
            </div>
          )}
        </div>

        {/* Main Content - PDF & Structured Invoice Fields */}
        {pdfUrl && (
          <div className="bg-white rounded-3xl shadow-xl p-8 mb-8 border border-gray-100">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-[600px]">
              {/* PDF Viewer - Left Side */}
              <div className="flex flex-col">
                <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Document Preview
                </h3>
                <div className="bg-gray-50 rounded-2xl p-4 flex-1">
                  <div className="bg-white rounded-xl shadow-lg overflow-hidden h-full">
                    <PdfViewer pdfData={pdfUrl} highlights={highlight} />
                  </div>
                </div>
              </div>
              
              {/* Structured Invoice Fields - Right Side */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    Invoice Data
                  </h3>
                  {!isProcessing && !Object.values(invoiceData).some(field => field.found) && (
                    <button
                      onClick={extractInvoiceData}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Extract Data
                    </button>
                  )}
                </div>

                {/* Processing Status */}
                {isProcessing && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-blue-800">{processingStep}</div>
                        {ocrProgress > 0 && (
                          <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                              style={{ width: `${ocrProgress}%` }}
                            ></div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Structured Fields */}
                <div className="bg-gray-50 rounded-2xl p-6 flex-1 overflow-y-auto">
                  <div className="space-y-4">
                    {/* Invoice Number */}
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                      <label className="text-sm font-semibold text-gray-600 block mb-2">Invoice Number</label>
                      <div className="flex items-center gap-3">
                        <input 
                          type="text" 
                          value={invoiceData.invoiceNumber.value}
                          onChange={(e) => setInvoiceData({
                            ...invoiceData,
                            invoiceNumber: { ...invoiceData.invoiceNumber, value: e.target.value }
                          })}
                          placeholder="Not extracted yet"
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {invoiceData.invoiceNumber.found && (
                          <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                            {Math.round(invoiceData.invoiceNumber.confidence)}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Invoice Date */}
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                      <label className="text-sm font-semibold text-gray-600 block mb-2">Invoice Date</label>
                      <div className="flex items-center gap-3">
                        <input 
                          type="text" 
                          value={invoiceData.date.value}
                          onChange={(e) => setInvoiceData({
                            ...invoiceData,
                            date: { ...invoiceData.date, value: e.target.value }
                          })}
                          placeholder="Not extracted yet"
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {invoiceData.date.found && (
                          <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                            {Math.round(invoiceData.date.confidence)}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Due Date */}
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                      <label className="text-sm font-semibold text-gray-600 block mb-2">Due Date</label>
                      <div className="flex items-center gap-3">
                        <input 
                          type="text" 
                          value={invoiceData.dueDate.value}
                          onChange={(e) => setInvoiceData({
                            ...invoiceData,
                            dueDate: { ...invoiceData.dueDate, value: e.target.value }
                          })}
                          placeholder="Not extracted yet"
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {invoiceData.dueDate.found && (
                          <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                            {Math.round(invoiceData.dueDate.confidence)}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Total Amount */}
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                      <label className="text-sm font-semibold text-gray-600 block mb-2">Total Amount</label>
                      <div className="flex items-center gap-3">
                        <input 
                          type="text" 
                          value={invoiceData.total.value}
                          onChange={(e) => setInvoiceData({
                            ...invoiceData,
                            total: { ...invoiceData.total, value: e.target.value }
                          })}
                          placeholder="Not extracted yet"
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {invoiceData.total.found && (
                          <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                            {Math.round(invoiceData.total.confidence)}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Subtotal */}
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                      <label className="text-sm font-semibold text-gray-600 block mb-2">Subtotal</label>
                      <div className="flex items-center gap-3">
                        <input 
                          type="text" 
                          value={invoiceData.subtotal.value}
                          onChange={(e) => setInvoiceData({
                            ...invoiceData,
                            subtotal: { ...invoiceData.subtotal, value: e.target.value }
                          })}
                          placeholder="Not extracted yet"
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {invoiceData.subtotal.found && (
                          <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                            {Math.round(invoiceData.subtotal.confidence)}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Tax */}
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                      <label className="text-sm font-semibold text-gray-600 block mb-2">Tax</label>
                      <div className="flex items-center gap-3">
                        <input 
                          type="text" 
                          value={invoiceData.tax.value}
                          onChange={(e) => setInvoiceData({
                            ...invoiceData,
                            tax: { ...invoiceData.tax, value: e.target.value }
                          })}
                          placeholder="Not extracted yet"
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {invoiceData.tax.found && (
                          <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                            {Math.round(invoiceData.tax.confidence)}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Vendor */}
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                      <label className="text-sm font-semibold text-gray-600 block mb-2">Vendor</label>
                      <div className="flex items-center gap-3">
                        <input 
                          type="text" 
                          value={invoiceData.vendor.value}
                          onChange={(e) => setInvoiceData({
                            ...invoiceData,
                            vendor: { ...invoiceData.vendor, value: e.target.value }
                          })}
                          placeholder="Not extracted yet"
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {invoiceData.vendor.found && (
                          <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                            {Math.round(invoiceData.vendor.confidence)}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Customer */}
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                      <label className="text-sm font-semibold text-gray-600 block mb-2">Customer</label>
                      <div className="flex items-center gap-3">
                        <input 
                          type="text" 
                          value={invoiceData.customer.value}
                          onChange={(e) => setInvoiceData({
                            ...invoiceData,
                            customer: { ...invoiceData.customer, value: e.target.value }
                          })}
                          placeholder="Not extracted yet"
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {invoiceData.customer.found && (
                          <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                            {Math.round(invoiceData.customer.confidence)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results Actions - Only show when we have extracted fields */}
        {fields.length > 0 && (
          <div className="bg-white rounded-3xl shadow-xl p-8 mb-8 border border-gray-100">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-gray-800">Extraction Results</h2>
                <p className="text-gray-600 mt-1">
                  AI-powered extraction with {Math.round(fields.reduce((acc, f) => acc + f.confidence, 0) / fields.length)}% average confidence
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setShowRawText(!showRawText)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
                >
                  {showRawText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showRawText ? 'Hide' : 'Show'} OCR Text
                </button>
                <button
                  onClick={copyToClipboard}
                  className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                    copySuccess 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  }`}
                >
                  {copySuccess ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy JSON
                    </>
                  )}
                </button>
                <button
                  onClick={downloadJSON}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-md"
                >
                  <Download className="w-4 h-4" />
                  Download JSON
                </button>
              </div>
            </div>

            {/* Raw OCR Text Display */}
            {showRawText && (
              <div className="mt-6">
                <h3 className="font-semibold text-gray-700 text-lg mb-4">Raw OCR Text</h3>
                <div className="bg-gray-900 text-gray-100 rounded-xl p-6 max-h-96 overflow-y-auto">
                  <pre className="text-sm whitespace-pre-wrap font-mono">
                    {rawOcrText || 'No OCR text available yet. Please extract data first.'}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Welcome Message when no data */}
        {!pdfUrl && !fields.length && (
          <div className="bg-white rounded-3xl shadow-xl p-12 border border-gray-100 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-24 h-24 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg">
                <FileCheck className="h-12 w-12 text-indigo-500" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">Ready for Advanced OCR Processing</h3>
              <p className="text-gray-600 leading-relaxed mb-8">
                Upload your PDF invoice above and witness AI-powered OCR extraction in action. 
                Our enhanced technology works with both digital and scanned documents.
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                  <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                  <div className="font-semibold text-indigo-800">Scanned PDFs</div>
                  <div className="text-indigo-600">OCR + AI extraction</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                  <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <Globe className="w-4 h-4 text-white" />
                  </div>
                  <div className="font-semibold text-purple-800">Multi-Language</div>
                  <div className="text-purple-600">10+ languages</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;