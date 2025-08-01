import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";

// Configure PDF.js worker
if (!pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.js';
}

export default function PdfViewer({ pdfUrl, highlights }) {
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pdf, setPdf] = useState(null);

  const renderTaskRef = useRef(null);
  const loadingTaskRef = useRef(null);

  // Clean up function
  const cleanup = () => {
    if (renderTaskRef.current) {
      try { 
        renderTaskRef.current.cancel(); 
      } catch {}
      renderTaskRef.current = null;
    }
    if (loadingTaskRef.current) {
      try { 
        loadingTaskRef.current.destroy(); 
      } catch {}
      loadingTaskRef.current = null;
    }
  };

  // render pdf when url changes
  useEffect(() => {
    const loadPdf = async () => {
      if (!pdfUrl || !canvasRef.current) return;

      // Clean up any previous operations
      cleanup();
      setLoading(true);
      setError(null);

      try {
        console.log("Loading PDF:", pdfUrl);
        loadingTaskRef.current = pdfjs.getDocument(pdfUrl);
        const pdfDoc = await loadingTaskRef.current.promise;
        console.log("PDF loaded successfully");
        
        setPdf(pdfDoc);

        const page = await pdfDoc.getPage(1);
        const scale = 1.5;
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas) return; // Double check canvas still exists
        
        const context = canvas.getContext("2d");
        // Clear canvas first
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        renderTaskRef.current = page.render({ canvasContext: context, viewport });
        await renderTaskRef.current.promise;
        renderTaskRef.current = null;
        console.log("PDF rendered successfully");

      } catch (err) {
        console.error("PDF loading error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
        loadingTaskRef.current = null;
      }
    };

    if (pdfUrl) {
      loadPdf();
    } else {
      cleanup();
      setPdf(null);
      setError(null);
    }

    // Cleanup on unmount or pdfUrl change
    return cleanup;
  }, [pdfUrl]);

  // draw highlights whenever they change
  useEffect(() => {
    if (!highlights?.length || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const scale = 1.5;
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    highlights.forEach(({x,y,w,h})=>{
      ctx.strokeRect(x*scale, y*scale, w*scale, h*scale);
    });
  }, [highlights]);

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
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-blue-600">Loading PDF...</span>
          </div>
        </div>
      )}
      <canvas ref={canvasRef} className="border w-full" />
    </div>
  );
}