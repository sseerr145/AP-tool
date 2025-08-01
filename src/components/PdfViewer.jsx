import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";

// Configure PDF.js worker - use proper path
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).href;

export default function PdfViewer({ pdfUrl, highlights }) {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pageScale, setPageScale] = useState(1.5);
  const renderTaskRef = useRef(null);
  const loadingTaskRef = useRef(null);

  useEffect(() => {
    const loadPdf = async () => {
      if (!pdfUrl || !canvasRef.current) return;

      // Cancel any ongoing render task
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (e) {
          console.log("Render task already completed");
        }
        renderTaskRef.current = null;
      }

      // Destroy any previous loading task
      if (loadingTaskRef.current) {
        try {
          loadingTaskRef.current.destroy();
        } catch (e) {
          console.log("Loading task already destroyed");
        }
        loadingTaskRef.current = null;
      }

      setLoading(true);
      setError(null);

      try {
        console.log("Loading PDF:", pdfUrl);
        loadingTaskRef.current = pdfjs.getDocument(pdfUrl);
        const pdfDoc = await loadingTaskRef.current.promise;
        console.log("PDF loaded successfully");

        const page = await pdfDoc.getPage(1);
        const viewport = page.getViewport({ scale: pageScale });

        const canvas = canvasRef.current;
        if (!canvas) return; // Component might have unmounted
        
        const context = canvas.getContext("2d");
        
        // Clear canvas before rendering
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        renderTaskRef.current = page.render(renderContext);
        await renderTaskRef.current.promise;
        console.log("PDF rendered successfully");

        renderTaskRef.current = null;
        
        // Clean up PDF document
        pdfDoc.destroy();
      } catch (err) {
        if (err.name !== 'RenderingCancelledException') {
          console.error("PDF loading error:", err);
          setError(err.message || "Failed to load PDF");
        }
      } finally {
        setLoading(false);
        loadingTaskRef.current = null;
      }
    };

    loadPdf();

    // Cleanup function
    return () => {
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (e) {
          // Ignore cancellation errors
        }
        renderTaskRef.current = null;
      }
      if (loadingTaskRef.current) {
        try {
          loadingTaskRef.current.destroy();
        } catch (e) {
          // Ignore destruction errors
        }
        loadingTaskRef.current = null;
      }
    };
  }, [pdfUrl, pageScale]);

  // Draw highlights on overlay canvas
  useEffect(() => {
    if (!highlights?.length || !overlayRef.current) return;
    
    const canvas = overlayRef.current;
    const ctx = canvas.getContext('2d');
    
    // Match overlay size to PDF canvas
    if (canvasRef.current) {
      canvas.width = canvasRef.current.width;
      canvas.height = canvasRef.current.height;
    }
    
    // Clear previous highlights
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw new highlights
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    
    highlights.forEach(({ x, y, w, h }) => {
      ctx.strokeRect(x * pageScale, y * pageScale, w * pageScale, h * pageScale);
    });
  }, [highlights, pageScale]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 border border-red-300 bg-red-50 rounded">
        <div className="text-center">
          <p className="text-red-600 font-medium">Failed to load PDF</p>
          <p className="text-red-500 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative inline-block">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-blue-600">Loading PDF...</span>
          </div>
        </div>
      )}
      <div className="relative">
        <canvas ref={canvasRef} className="border" />
        <canvas 
          ref={overlayRef} 
          className="absolute top-0 left-0 pointer-events-none" 
          style={{ border: 'none' }}
        />
      </div>
    </div>
  );
}