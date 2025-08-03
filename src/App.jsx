import React, { useState, useCallback } from 'react';
import { Upload, FileText, AlertCircle, Loader2, X, DollarSign, Calendar, Building, Hash, CheckCircle } from 'lucide-react';
import { performOCR } from './utils/ocrProcessor';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker for Electron
pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.mjs';

const FileUploadArea = ({ onFileSelect, isProcessing, progress }) => {
  const [dragActive, setDragActive] = useState(false);

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
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf') {
        onFileSelect(file);
      } else {
        alert('Please select a PDF file.');
      }
    }
  }, [onFileSelect]);

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === 'application/pdf') {
        onFileSelect(file);
      } else {
        alert('Please select a PDF file.');
      }
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="w-full max-w-2xl mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">Invoice Extraction Tool</h1>
          <p className="text-xl text-gray-600">Upload your invoice PDF to extract data automatically</p>
        </div>

        <div
          className={`relative border-2 border-dashed rounded-3xl p-16 text-center transition-all duration-300 ${
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          } ${isProcessing ? 'pointer-events-none opacity-75' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          {isProcessing ? (
            <div className="flex flex-col items-center">
              <Loader2 className="w-20 h-20 text-blue-600 animate-spin mb-6" />
              <h3 className="text-2xl font-semibold text-gray-900 mb-3">Processing Invoice</h3>
              <p className="text-gray-600 mb-4">Extracting data from your document...</p>
              {progress > 0 && (
                <div className="w-full max-w-xs">
                  <div className="bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">{progress}% complete</p>
                </div>
              )}
            </div>
          ) : (
            <>
              <Upload className="w-20 h-20 text-gray-400 mx-auto mb-6" />
              <h3 className="text-2xl font-semibold text-gray-900 mb-3">Drop your invoice here</h3>
              <p className="text-gray-600 mb-8">or click to browse files</p>
              
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileInput}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              
              <button className="bg-blue-600 text-white px-8 py-4 rounded-xl font-medium hover:bg-blue-700 transition-colors text-lg">
                Choose PDF File
              </button>
              
              <p className="text-sm text-gray-500 mt-6">PDF files only • Max 50MB</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const PDFViewer = ({ file }) => {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [pageRendering, setPageRendering] = useState(false);
  const [pageNumPending, setPageNumPending] = useState(null);
  const [canvasRef, setCanvasRef] = useState(null);

  React.useEffect(() => {
    if (file) {
      const fileReader = new FileReader();
      fileReader.onload = function() {
        const typedArray = new Uint8Array(this.result);
        pdfjsLib.getDocument(typedArray).promise.then(pdf => {
          setPdfDoc(pdf);
          renderPage(1, pdf);
        });
      };
      fileReader.readAsArrayBuffer(file);
    }
  }, [file]);

  const renderPage = (num, pdf = pdfDoc) => {
    if (!pdf || !canvasRef) return;
    
    setPageRendering(true);
    
    pdf.getPage(num).then(page => {
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = canvasRef;
      const ctx = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport
      };

      const renderTask = page.render(renderContext);
      renderTask.promise.then(() => {
        setPageRendering(false);
        if (pageNumPending !== null) {
          renderPage(pageNumPending);
          setPageNumPending(null);
        }
      });
    });
  };

  const queueRenderPage = (num) => {
    if (pageRendering) {
      setPageNumPending(num);
    } else {
      renderPage(num);
    }
  };

  const onPrevPage = () => {
    if (pageNum <= 1) return;
    const newPageNum = pageNum - 1;
    setPageNum(newPageNum);
    queueRenderPage(newPageNum);
  };

  const onNextPage = () => {
    if (!pdfDoc || pageNum >= pdfDoc.numPages) return;
    const newPageNum = pageNum + 1;
    setPageNum(newPageNum);
    queueRenderPage(newPageNum);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-gray-900 flex items-center">
          <FileText className="w-6 h-6 mr-3" />
          PDF Preview
        </h3>
        {pdfDoc && (
          <div className="flex items-center space-x-3">
            <button
              onClick={onPrevPage}
              disabled={pageNum <= 1}
              className="px-4 py-2 text-sm bg-gray-100 rounded-lg disabled:opacity-50 hover:bg-gray-200 transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600 font-medium">
              {pageNum} of {pdfDoc.numPages}
            </span>
            <button
              onClick={onNextPage}
              disabled={pageNum >= pdfDoc.numPages}
              className="px-4 py-2 text-sm bg-gray-100 rounded-lg disabled:opacity-50 hover:bg-gray-200 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
      
      <div className="border rounded-xl overflow-hidden bg-gray-50 flex justify-center p-4">
        <canvas
          ref={setCanvasRef}
          className="max-w-full h-auto shadow-lg rounded-lg"
        />
      </div>
    </div>
  );
};

const InvoiceDataForm = ({ extractedData, onClear }) => {
  const [formData, setFormData] = useState(extractedData || {});

  React.useEffect(() => {
    if (extractedData) {
      setFormData(extractedData);
    }
  }, [extractedData]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const formatCurrency = (amount) => {
    if (!amount) return '';
    const numericAmount = amount.toString().replace(/[^0-9.]/g, '');
    return numericAmount ? `$${numericAmount}` : '';
  };

  const handleSave = () => {
    // In Electron, you could save to local file system
    console.log('Saving invoice data:', formData);
    // Add actual save functionality here
    alert('Invoice data saved successfully!');
  };

  const handleExport = () => {
    // Export to CSV functionality for Electron
    const csvData = Object.entries(formData)
      .filter(([key, value]) => key !== 'lineItems' && key !== 'rawText' && value)
      .map(([key, value]) => `${key},${value}`)
      .join('\n');
    
    console.log('CSV Export:', csvData);
    // Add actual CSV export functionality here
    alert('CSV export ready! (Check console for data)');
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xl font-semibold text-gray-900">Extracted Invoice Data</h3>
        <button
          onClick={onClear}
          className="flex items-center px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
        >
          <X className="w-4 h-4 mr-2" />
          Clear & Process Next
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Hash className="w-4 h-4 inline mr-1" />
            Invoice Number
          </label>
          <input
            type="text"
            value={formData.invoiceNumber || ''}
            onChange={(e) => handleInputChange('invoiceNumber', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Not found"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="w-4 h-4 inline mr-1" />
            Invoice Date
          </label>
          <input
            type="date"
            value={formData.invoiceDate || ''}
            onChange={(e) => handleInputChange('invoiceDate', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Building className="w-4 h-4 inline mr-1" />
            Vendor Name
          </label>
          <input
            type="text"
            value={formData.vendorName || ''}
            onChange={(e) => handleInputChange('vendorName', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Not found"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <DollarSign className="w-4 h-4 inline mr-1" />
            Total Amount
          </label>
          <input
            type="text"
            value={formatCurrency(formData.totalAmount)}
            onChange={(e) => handleInputChange('totalAmount', e.target.value.replace('$', ''))}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="$0.00"
          />
        </div>
      </div>

      {formData.lineItems && formData.lineItems.length > 0 && (
        <div className="mt-8">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Line Items</h4>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Description</th>
                  <th className="px-6 py-3 text-right text-sm font-medium text-gray-700">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {formData.lineItems.map((item, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 text-sm text-gray-900">{item.description}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">{formatCurrency(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-8 flex space-x-4">
        <button 
          onClick={handleSave}
          className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center"
        >
          <CheckCircle className="w-5 h-5 mr-2" />
          Save Invoice Data
        </button>
        <button 
          onClick={handleExport}
          className="flex-1 bg-gray-100 text-gray-700 py-3 px-6 rounded-lg hover:bg-gray-200 transition-colors font-medium"
        >
          Export to CSV
        </button>
      </div>
    </div>
  );
};

const App = () => {
  const [currentFile, setCurrentFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  const handleFileSelect = async (file) => {
    console.log('📄 File selected:', file.name, (file.size / 1024 / 1024).toFixed(2) + ' MB');
    
    setCurrentFile(file);
    setIsProcessing(true);
    setError(null);
    setProgress(0);

    try {
      // Perform OCR extraction with progress tracking
      const data = await performOCR(file, (progressValue) => {
        setProgress(progressValue);
      });
      
      console.log('🎉 Extraction completed:', data);
      setExtractedData(data);
    } catch (err) {
      setError('Failed to process the invoice. Please try again.');
      console.error('❌ OCR Error:', err);
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleClear = () => {
    setCurrentFile(null);
    setExtractedData(null);
    setError(null);
    setIsProcessing(false);
    setProgress(0);
  };

  // Show upload area if no file or still processing
  if (!currentFile || isProcessing) {
    return <FileUploadArea onFileSelect={handleFileSelect} isProcessing={isProcessing} progress={progress} />;
  }

  // Show main interface with PDF and extracted data
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Invoice Extraction Tool</h1>
          <p className="text-gray-600">Review and edit the extracted invoice data</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <PDFViewer file={currentFile} />
          <InvoiceDataForm extractedData={extractedData} onClear={handleClear} />
        </div>
      </div>
    </div>
  );
};

export default App;