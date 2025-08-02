import { useEffect, useRef, useState } from "react";
import { loadPdfForPreview } from "../utils/pdfService";
import { renderingManager } from "../utils/renderingState";

export default function PdfViewer({ pdfData, highlights }) {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pageScale, setPageScale] = useState(1.2);
  const renderTaskRef = useRef(null);
  const isRenderingRef = useRef(false);

  useEffect(() => {
    const loadPdf = async () => {
      if (!pdfData || !canvasRef.current) return;
      
      // Use global rendering manager to prevent conflicts
      const renderFunction = async () => {
        // Cancel any previous render task first
        if (renderTaskRef.current) {
          try {
            console.log("Cancelling previous render task...");
            renderTaskRef.current.cancel();
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (e) {
            console.log("Previous render task cleanup:", e.message);
          }
          renderTaskRef.current = null;
        }
        
        // Create fresh ArrayBuffer for preview to avoid detachment issues
        let arrayBuffer;
        if (pdfData instanceof File) {
          arrayBuffer = await pdfData.arrayBuffer();
        } else {
          arrayBuffer = pdfData; // Fallback for existing ArrayBuffer
        }

        setLoading(true);
        setError(null);

        try {
          console.log("Loading PDF from data");

          const pdfDoc = await loadPdfForPreview(arrayBuffer);
          console.log("PDF loaded successfully, pages:", pdfDoc.numPages);

          const page = await pdfDoc.getPage(1);
          const viewport = page.getViewport({ scale: pageScale });

          const canvas = canvasRef.current;
          if (!canvas) {
            console.log("Canvas not available, skipping render");
            return;
          }

          const context = canvas.getContext("2d");
          if (!context) {
            console.log("Canvas context not available");
            return;
          }

          // Clear and reset canvas completely before rendering
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          context.clearRect(0, 0, canvas.width, canvas.height);

          // Set overlay dimensions to match canvas
          if (overlayRef.current) {
            overlayRef.current.style.width = `${viewport.width}px`;
            overlayRef.current.style.height = `${viewport.height}px`;
          }

          const renderContext = {
            canvasContext: context,
            viewport: viewport,
          };

          renderTaskRef.current = page.render(renderContext);
          await renderTaskRef.current.promise;

          console.log("PDF rendered successfully");

          // Cleanup
          pdfDoc.destroy();
          setLoading(false);
          renderTaskRef.current = null;
        } catch (error) {
          console.error("Error loading PDF:", error);
          setError(`Failed to load PDF: ${error.message}`);
          setLoading(false);
          renderTaskRef.current = null;
        } finally {
          // Always reset rendering flag
          isRenderingRef.current = false;
        }
      };

      // Execute rendering through global manager
      try {
        await renderingManager.executeRender(renderFunction, 'PDF Preview');
      } catch (error) {
        console.error("Rendering manager error:", error);
        setError("PDF rendering failed. Please try again.");
        setLoading(false);
      }
    };

    loadPdf();

    // Cleanup function
    return () => {
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (e) {
          console.log("Cleanup: Render task already completed");
        }
        renderTaskRef.current = null;
      }
      // Reset rendering flag on cleanup
      isRenderingRef.current = false;
    };
  }, [pdfData, pageScale]);

  // Handle zoom controls
  const handleZoom = (direction) => {
    setPageScale(prevScale => {
      const newScale = direction === 'in' 
        ? Math.min(prevScale + 0.2, 3) 
        : Math.max(prevScale - 0.2, 0.5);
      return newScale;
    });
  };

  return (
    <div className="relative">
      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 z-10 bg-white rounded-lg shadow-md border border-gray-200 flex items-center">
        <button
          onClick={() => handleZoom('out')}
          className="p-2 hover:bg-gray-100 rounded-l-lg transition-colors"
          title="Zoom Out"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        
        <span className="px-3 text-sm font-medium text-gray-700 select-none">
          {Math.round(pageScale * 100)}%
        </span>
        
        <button
          onClick={() => handleZoom('in')}
          className="p-2 hover:bg-gray-100 rounded-r-lg transition-colors"
          title="Zoom In"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* PDF Container */}
      <div className="relative overflow-auto max-h-[80vh] border border-gray-300 rounded-lg bg-gray-100">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 z-20">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="mt-3 text-gray-600">Loading PDF...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white z-20">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-red-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-600 font-medium">Error loading PDF</p>
              <p className="text-gray-500 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Canvas and Highlight Overlay */}
        <div className="relative mx-auto">
          <canvas
            ref={canvasRef}
            className="block mx-auto shadow-lg"
            style={{ maxWidth: '100%', height: 'auto' }}
          />
          
          {/* Highlight Overlay */}
          <div
            ref={overlayRef}
            className="absolute top-0 left-1/2 transform -translate-x-1/2 pointer-events-none"
          >
            {highlights.map((coords, idx) => (
              <div
                key={idx}
                className="absolute border-2 border-blue-500 bg-blue-200 bg-opacity-30 rounded animate-pulse"
                style={{
                  left: `${coords.x * pageScale}px`,
                  top: `${coords.y * pageScale}px`,
                  width: `${coords.w * pageScale}px`,
                  height: `${coords.h * pageScale}px`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Page Info */}
      {!loading && !error && pdfData && (
        <div className="mt-3 text-center text-sm text-gray-500">
          Page 1 of 1 • Scale: {Math.round(pageScale * 100)}%
        </div>
      )}
    </div>
  );
}