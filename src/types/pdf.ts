/**
 * PDF Parser & Renderer Types
 * Spatial token representations and PDF.js wrapper interfaces.
 */

export interface TextItem {
  str: string;
  dir: string;
  width: number;
  height: number;
  transform: number[];
  x: number;
  y: number;
  fontSize: number;
  fontName?: string;
  hasEOL?: boolean;
}

export interface TextLine {
  y: number;
  items: TextItem[];
  minX: number;
  maxX: number;
  avgFontSize: number;
  text?: string;
}

export interface PdfPageViewport {
  width: number;
  height: number;
  scale: number;
}

export interface PdfRenderablePage {
  getViewport: (options: { scale: number }) => PdfPageViewport;
  render: (renderContext: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfPageViewport;
    enableWebGL?: boolean;
    renderInteractiveForms?: boolean;
  }) => { promise: Promise<void> };
}

export interface PdfDocumentLike {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfRenderablePage>;
  getMetadata?: () => Promise<{ info?: Record<string, string> }>;
}
