import React, { useRef, useEffect, useCallback } from 'react';
import {
  FileText,
  AlignLeft,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';
import { renderPageToCanvas, type PdfDocumentLike } from '../../lib/pdf-parser';

export interface PdfViewerProps {
  pdfDoc: PdfDocumentLike | null;
  rawText: string;
  currentPageNum: number;
  totalPages: number;
  zoom: number;
  viewMode: 'canvas' | 'text';
  onViewModeChange: (mode: 'canvas' | 'text') => void;
  onPageChange: (pageNum: number) => void;
  onZoomChange: (zoom: number) => void;
  onOpenAisModal: () => void;
}

export const PdfViewer: React.FC<Readonly<PdfViewerProps>> = ({
  pdfDoc,
  rawText,
  currentPageNum,
  totalPages,
  zoom,
  viewMode,
  onViewModeChange,
  onPageChange,
  onZoomChange,
  onOpenAisModal,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const renderCurrentPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current || viewMode !== 'canvas') return;
    try {
      const page = await pdfDoc.getPage(currentPageNum);
      await renderPageToCanvas(page, canvasRef.current, zoom);
    } catch (err) {
      console.warn('Failed to render PDF page to canvas:', err);
    }
  }, [pdfDoc, currentPageNum, zoom, viewMode]);

  useEffect(() => {
    void renderCurrentPage();
  }, [renderCurrentPage]);

  const handleZoomIn = () => {
    if (zoom < 2.5 && pdfDoc) {
      onZoomChange(zoom + 0.25);
    }
  };

  const handleZoomOut = () => {
    if (zoom > 0.75 && pdfDoc) {
      onZoomChange(zoom - 0.25);
    }
  };

  const handleFitZoom = async () => {
    if (!pdfDoc || !containerRef.current) return;
    try {
      const page = await pdfDoc.getPage(currentPageNum);
      const nativeViewport = page.getViewport({ scale: 1.0 });
      const container = containerRef.current;
      const style = window.getComputedStyle(container);
      const padH =
        (Number.parseFloat(style.paddingLeft) || 0) +
        (Number.parseFloat(style.paddingRight) || 0);
      const innerWidth = container.clientWidth - padH;
      if (innerWidth > 0 && nativeViewport.width > 0) {
        onZoomChange(innerWidth / nativeViewport.width);
      }
    } catch (err) {
      console.warn('Failed to calculate fit zoom:', err);
    }
  };

  const isCanvasMode = viewMode === 'canvas';
  const showPdfControls = isCanvasMode && Boolean(pdfDoc);

  return (
    <div className="workspace-viewer-card">
      <div className="pdf-viewer-card">
        {/* Toolbar */}
        <div className="pdf-viewer-toolbar">
          {/* View Switcher: PDF Canvas vs Text Stream */}
          <div className="doc-view-toggle">
            <button
              type="button"
              id="viewCanvasBtn"
              className={`btn btn-secondary btn-xs ${isCanvasMode ? 'active' : ''}`}
              onClick={() => onViewModeChange('canvas')}
            >
              <FileText className="btn-icon-xs" size={14} />
              <span>PDF Document</span>
            </button>
            <button
              type="button"
              id="viewTextBtn"
              className={`btn btn-secondary btn-xs ${!isCanvasMode ? 'active' : ''}`}
              onClick={() => onViewModeChange('text')}
            >
              <AlignLeft className="btn-icon-xs" size={14} />
              <span>Text Stream</span>
            </button>
          </div>

          {/* Open AIS Modal from Viewer Toolbar */}
          <button
            type="button"
            id="btnToolbarOpenAis"
            className="btn btn-primary btn-xs"
            title="Open AIS Part A & Part B Modal"
            onClick={onOpenAisModal}
          >
            <LayoutDashboard className="btn-icon-xs" size={14} />
            <span>Show AIS (Part A &amp; B)</span>
          </button>

          {/* PDF Page Navigation */}
          {showPdfControls && (
            <div id="pdfNavControls" className="pdf-nav-controls" style={{ display: 'flex' }}>
              <button
                type="button"
                id="prevPageBtn"
                className="btn btn-secondary btn-xs"
                disabled={currentPageNum <= 1}
                onClick={() => onPageChange(currentPageNum - 1)}
              >
                <ChevronLeft className="btn-icon-xs" size={14} />
                <span>Prev</span>
              </button>
              <span id="pdfPageIndicator" className="page-indicator">
                Page {currentPageNum} of {totalPages}
              </span>
              <button
                type="button"
                id="nextPageBtn"
                className="btn btn-secondary btn-xs"
                disabled={currentPageNum >= totalPages}
                onClick={() => onPageChange(currentPageNum + 1)}
              >
                <span>Next</span>
                <ChevronRight className="btn-icon-xs" size={14} />
              </button>
            </div>
          )}

          {/* PDF Zoom Controls */}
          {showPdfControls && (
            <div id="pdfZoomControls" className="pdf-zoom-controls" style={{ display: 'flex' }}>
              <button
                type="button"
                id="zoomOutBtn"
                className="btn btn-secondary btn-xs"
                title="Zoom Out"
                onClick={handleZoomOut}
              >
                <ZoomOut className="btn-icon-xs" size={14} />
              </button>
              <span id="zoomLevelText" className="zoom-text">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                id="zoomInBtn"
                className="btn btn-secondary btn-xs"
                title="Zoom In"
                onClick={handleZoomIn}
              >
                <ZoomIn className="btn-icon-xs" size={14} />
              </button>
              <button
                type="button"
                id="zoomFitBtn"
                className="btn btn-secondary btn-xs"
                title="Fit Width"
                onClick={() => void handleFitZoom()}
              >
                <Maximize2 className="btn-icon-xs" size={14} />
                <span>Fit</span>
              </button>
            </div>
          )}
        </div>

        {/* PDF Canvas View */}
        <div
          ref={containerRef}
          className={`pdf-canvas-container ${!isCanvasMode ? 'hidden' : ''}`}
          id="pdfCanvasContainer"
        >
          {pdfDoc ? (
            <canvas id="pdfPageCanvas" ref={canvasRef} className="pdf-canvas" />
          ) : (
            <div id="pdfNoPreviewMessage" className="no-pdf-placeholder">
              <FileText className="placeholder-icon" size={32} />
              <p className="font-semibold text-primary">
                Text / CSV Document Loaded
              </p>
              <p className="text-xs text-secondary mt-1">
                Click the &quot;Text Stream&quot; button above to view the full document contents.
              </p>
            </div>
          )}
        </div>

        {/* Text Stream View */}
        <div
          id="rawTextContainer"
          className={`raw-text-container ${isCanvasMode ? 'hidden' : ''}`}
        >
          <div className="text-stream-header">
            <span className="text-xs font-semibold text-secondary">
              Extracted Text Stream (Full Document)
            </span>
          </div>
          <pre id="rawTextDisplay" className="doc-text-box">
            {rawText}
          </pre>
        </div>
      </div>
    </div>
  );
};
