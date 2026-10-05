import * as pdfjsLib from 'pdfjs-dist';
import type { PdfParseProgress, PdfParseResult } from '../types/ais';

// Set up PDF.js worker
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
} catch (err) {
  console.warn('Worker configuration note:', err);
}

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

/**
 * Parse an uploaded PDF file into raw text, metadata, and page layouts.
 */
export async function parsePdfDocument(
  file: File | ArrayBuffer | Blob,
  onProgress: (prog: PdfParseProgress) => void = () => {},
  password: string | null = null,
  onPasswordRequest: ((isRetry: boolean) => Promise<string | null>) | null = null
): Promise<PdfParseResult> {
  let arrayBuffer: ArrayBuffer;
  let fileName = 'document.pdf';
  let fileSize = 0;

  if (file instanceof File) {
    fileName = file.name || 'document.pdf';
    fileSize = file.size || 0;
    arrayBuffer = await file.arrayBuffer();
  } else if (file instanceof Blob) {
    fileSize = file.size || 0;
    arrayBuffer = await file.arrayBuffer();
  } else if (file instanceof ArrayBuffer) {
    arrayBuffer = file;
    fileSize = file.byteLength;
  } else {
    throw new Error('Unsupported file input type');
  }

  onProgress({ stage: 'loading', percent: 15, message: 'Loading PDF binary stream...' });

  const docInitParams: Record<string, unknown> = {
    data: arrayBuffer,
    cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/standard_fonts/`,
  };

  if (password) {
    docInitParams.password = password;
  }

  const loadingTask = pdfjsLib.getDocument(docInitParams as Parameters<typeof pdfjsLib.getDocument>[0]);

  if (onPasswordRequest) {
    loadingTask.onPassword = async (callback: (pwdOrErr: string | Error) => void, reason: number) => {
      try {
        const isRetry = reason === 2;
        const pass = await onPasswordRequest(isRetry);
        if (pass) {
          callback(pass);
        } else {
          callback(new Error('Password cancelled by user'));
        }
      } catch (err: unknown) {
        callback(err instanceof Error ? err : new Error(String(err)));
      }
    };
  }

  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const pagesData: PdfParseResult['pages'] = [];
  const fullTextParts: string[] = [];

  onProgress({ stage: 'parsing', percent: 35, message: `Extracting ${numPages} page(s)...` });

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });
    const textContent = await page.getTextContent();
    
    // Sort text items by vertical position (top to bottom), then horizontal (left to right)
    const rawItems = textContent.items as Array<{
      str: string;
      dir: string;
      width: number;
      height?: number;
      transform: number[];
      fontName?: string;
      hasEOL?: boolean;
    }>;

    const items: TextItem[] = rawItems.map(item => {
      const transform = item.transform;
      const x = transform[4];
      const y = viewport.height - transform[5]; // Flip Y for standard DOM origin
      const width = item.width * (viewport.scale / (viewport.scale || 1));
      const height = item.height || Math.abs(transform[0]) || 12;
      return {
        str: item.str,
        dir: item.dir,
        width,
        height,
        transform,
        x,
        y,
        fontSize: Math.abs(transform[0]) || 12,
        fontName: item.fontName,
        hasEOL: item.hasEOL
      };
    });

    // Reconstruct lines preserving spatial layout
    const lines = groupItemsIntoLines(items);
    const pageText = lines.map(line => line.text || '').join('\n');

    fullTextParts.push(`--- Page ${pageNum} ---\n` + pageText);
    pagesData.push({
      pageNumber: pageNum,
      width: viewport.width,
      height: viewport.height,
      items,
      lines,
      text: pageText,
      pageObject: page,
      viewport
    });

    const progressPct = 35 + Math.round((pageNum / numPages) * 45);
    onProgress({ stage: 'extracting', percent: progressPct, message: `Processed page ${pageNum} of ${numPages}...` });
  }

  // Extract document metadata
  let docMetadata: Record<string, unknown> = {};
  try {
    const meta = (await pdf.getMetadata()) as { info?: Record<string, string> };
    docMetadata = {
      title: meta?.info?.Title || fileName,
      author: meta?.info?.Author || 'Unknown',
      creator: meta?.info?.Creator || 'Unknown',
      producer: meta?.info?.Producer || 'Unknown',
      creationDate: meta?.info?.CreationDate || null,
      modificationDate: meta?.info?.ModDate || null,
      pdfVersion: meta?.info?.PDFFormatVersion || '1.7',
    };
  } catch (e) {
    console.warn('Metadata extraction skipped:', e);
  }

  onProgress({ stage: 'finishing', percent: 95, message: 'Structuring extracted tokens...' });

  return {
    fileName,
    fileSize,
    pageCount: numPages,
    rawText: fullTextParts.join('\n\n'),
    pages: pagesData,
    metadata: docMetadata,
    pdfDoc: pdf
  };
}

/**
 * Groups raw PDF text items into coherent horizontal lines
 */
function groupItemsIntoLines(items: TextItem[]): TextLine[] {
  if (!items || items.length === 0) return [];

  // Sort by Y coordinate primarily (with 4px line tolerance)
  const sorted = [...items].sort((a, b) => {
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) > 4) {
      return yDiff;
    }
    return a.x - b.x;
  });

  const lines: TextLine[] = [];
  let currentLine: TextLine = {
    y: sorted[0].y,
    items: [sorted[0]],
    minX: sorted[0].x,
    maxX: sorted[0].x + sorted[0].width,
    avgFontSize: sorted[0].fontSize
  };

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    if (Math.abs(item.y - currentLine.y) <= 5) {
      currentLine.items.push(item);
      currentLine.maxX = Math.max(currentLine.maxX, item.x + item.width);
      currentLine.y = (currentLine.y * (currentLine.items.length - 1) + item.y) / currentLine.items.length;
    } else {
      lines.push(finalizeLine(currentLine));
      currentLine = {
        y: item.y,
        items: [item],
        minX: item.x,
        maxX: item.x + item.width,
        avgFontSize: item.fontSize
      };
    }
  }

  if (currentLine.items.length > 0) {
    lines.push(finalizeLine(currentLine));
  }

  return lines;
}

function finalizeLine(line: TextLine): TextLine {
  line.items.sort((a, b) => a.x - b.x);
  line.text = assembleLineText(line.items);
  return line;
}

function assembleLineText(items: TextItem[]): string {
  const parts: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (i > 0) {
      const prev = items[i - 1];
      const gap = item.x - (prev.x + prev.width);
      if (gap > 4) {
        parts.push(' ');
      }
    }
    parts.push(item.str);
  }
  return parts.join('').trim();
}

export interface PdfPageViewport {
  width: number;
  height: number;
  scale: number;
}

export interface PdfDocumentLike {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfRenderablePage>;
  getMetadata?: () => Promise<{ info?: Record<string, string> }>;
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

/**
 * Render a specific page to an HTML Canvas element with HiDPI (Retina) crispness
 */
export async function renderPageToCanvas(
  pageObject: PdfRenderablePage | null | undefined,
  canvas: HTMLCanvasElement | null,
  scale = 1.5
): Promise<PdfPageViewport | undefined> {
  if (!pageObject || !canvas) return undefined;

  const dpr = Math.max(window.devicePixelRatio || 1, 2);
  const viewport = pageObject.getViewport({ scale });
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return undefined;

  // Set internal resolution multiplied by DPR for razor-sharp vector text rendering
  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);

  // Set CSS display size to logical viewport
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  context.save();
  context.scale(dpr, dpr);

  const renderContext = {
    canvasContext: context,
    viewport: viewport,
    enableWebGL: true,
    renderInteractiveForms: false
  };

  await pageObject.render(renderContext).promise;
  context.restore();
  return viewport;
}
