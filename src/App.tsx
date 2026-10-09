import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  ShieldCheck,
  Sun,
  Moon,
  FileCheck,
  FileUp,
  FileText,
  AlignLeft,
  Table,
  Code,
  Clock,
  Trash2,
  X,
  Calendar,
  Upload,
  LayoutDashboard,
  Wallet,
  Layers,
  Receipt,
  TrendingUp,
  CreditCard,
  BadgeDollarSign,
  ArrowUpRight,
} from 'lucide-react';

import {
  ColorIndigo500,
  ColorViolet500,
  ColorEmerald500,
  ColorSky500,
} from '@svinayaka/siddi-design-system/tokens';

import { parsePdfDocument, type PdfDocumentLike } from './lib/pdf-parser';
import { extractAndClassifyAis } from './lib/extractor-client';
import { classifyItr } from './lib/itr-classifier';
import { formatInr } from './lib/dom-utils';
import { buildJsonStructuredData } from './lib/json-builder';
import {
  saveTaxSession,
  loadTaxSession,
  clearTaxSession,
  formatRemainingTime,
} from './lib/storage';

import type {
  AisDeveloperSchema,
  StructuredExtractionResult,
  ItrClassificationResult,
  PartB1TdsTcsTransaction,
  PartB1LineItem,
} from './types/ais';

import {
  AisItrAdvisor,
  AisTaxCalculator,
  AisDetailsModal,
  PasswordModal,
  PdfViewer,
} from './components/ais';
import {
  ToastContainer,
  type ToastItem,
  type ToastVariant as ToastType,
} from './components/shared';

interface UploadProgressState {
  isUploading: boolean;
  stagePercent: number;
  title: string;
  detail: string;
}

let nextToastId = 0;
function generateToastId(): string {
  nextToastId += 1;
  return `toast-${Date.now()}-${nextToastId}`;
}

function triggerConfetti(): void {
  void confetti({
    particleCount: 50,
    spread: 60,
    origin: { y: 0.7 },
    colors: [ColorIndigo500, ColorViolet500, ColorEmerald500, ColorSky500],
  });
}

function formatPeriodBanner(aisData: AisDeveloperSchema | null): string {
  if (!aisData) return '';
  if (aisData.financial_year && aisData.assessment_year) {
    return `FY: ${aisData.financial_year} | AY: ${aisData.assessment_year}`;
  }
  if (aisData.assessment_year) {
    return `AY: ${aisData.assessment_year}`;
  }
  if (aisData.tax_year) {
    return `AY: ${aisData.tax_year}`;
  }
  return 'AY 2026-27';
}

function calculateTotalTdsDeducted(
  transactions: PartB1TdsTcsTransaction[]
): number {
  return transactions.reduce((sum, d) => {
    const lines = d.line_items || [];
    const linesTotal = lines.reduce((lSum: number, l: PartB1LineItem) => {
      const isInactive = (l.status || '').toLowerCase() === 'inactive';
      return isInactive ? lSum : lSum + (l.tds_deducted || 0);
    }, 0);
    return sum + linesTotal;
  }, 0);
}

export const App: React.FC = () => {
  // Theme state
  const [theme, setTheme] = useState<string>(
    () => localStorage.getItem('ais_theme') || 'dark'
  );

  // Document & Extraction state
  const [rawText, setRawText] = useState<string>('');
  const [pdfDoc, setPdfDoc] = useState<PdfDocumentLike | null>(null);
  const [currentPageNum, setCurrentPageNum] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(1.5);
  const [docViewMode, setDocViewMode] = useState<'canvas' | 'text'>('canvas');
  const [structuredData, setStructuredData] =
    useState<StructuredExtractionResult | null>(null);
  const [itrRecommendation, setItrRecommendation] =
    useState<ItrClassificationResult | null>(null);
  const [isEligibleForItr1, setIsEligibleForItr1] = useState<boolean>(true);

  // Session restored notification banner
  const [showSessionBanner, setShowSessionBanner] = useState<boolean>(false);
  const [sessionExpiresText, setSessionExpiresText] = useState<string>('');

  // Modals state
  const [aisModalOpen, setAisModalOpen] = useState<boolean>(false);
  const [modalTargetSection, setModalTargetSection] = useState<string | null>(
    null
  );

  // Password Modal state & deferred promise resolver
  const [passwordModalOpen, setPasswordModalOpen] = useState<boolean>(false);
  const [passwordModalRetry, setPasswordModalRetry] = useState<boolean>(false);
  const pendingPasswordResolverRef = useRef<((pw: string | null) => void) | null>(
    null
  );

  // Upload progress overlay
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState>({
    isUploading: false,
    stagePercent: 0,
    title: 'Parsing AIS Document...',
    detail: 'Reading document stream...',
  });

  // Drag over dropzone
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --------------------------------------------------------------------------
  // Toast notifications handler
  // --------------------------------------------------------------------------
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration = 3000) => {
      const id = generateToastId();
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        removeToast(id);
      }, duration);
    },
    [removeToast]
  );

  // --------------------------------------------------------------------------
  // Theme synchronizer
  // --------------------------------------------------------------------------
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.ksvDsTheme = theme;
    localStorage.setItem('ais_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    showToast(`Switched to ${nextTheme} theme`, 'info', 2000);
  };

  // --------------------------------------------------------------------------
  // Password Prompt for Encrypted PDFs
  // --------------------------------------------------------------------------
  const promptForPdfPassword = useCallback(
    (isRetry = false): Promise<string | null> => {
      return new Promise((resolve) => {
        setPasswordModalRetry(isRetry);
        setPasswordModalOpen(true);
        pendingPasswordResolverRef.current = resolve;
      });
    },
    []
  );

  const handlePasswordSubmit = (password: string) => {
    setPasswordModalOpen(false);
    if (pendingPasswordResolverRef.current) {
      pendingPasswordResolverRef.current(password);
      pendingPasswordResolverRef.current = null;
    }
  };

  const handlePasswordCancel = () => {
    setPasswordModalOpen(false);
    if (pendingPasswordResolverRef.current) {
      pendingPasswordResolverRef.current(null);
      pendingPasswordResolverRef.current = null;
    }
  };

  // --------------------------------------------------------------------------
  // File Ingestion Pipeline
  // --------------------------------------------------------------------------
  const processPdfFile = async (file: File) => {
    const parseResult = await parsePdfDocument(
      file,
      ({ stage, percent, message }) => {
        let stageTitle = 'Reading AIS PDF Binary...';
        if (stage === 'parsing') stageTitle = 'Extracting Layout Stream...';
        if (stage === 'extracting') stageTitle = 'Parsing Part A & Part B...';
        if (stage === 'finishing') stageTitle = 'Sanitizing PII & Finalizing...';

        setUploadProgress({
          isUploading: true,
          stagePercent: percent,
          title: stageTitle,
          detail: message,
        });
      },
      null,
      promptForPdfPassword
    );

    setRawText(parseResult.rawText);
    setPdfDoc(parseResult.pdfDoc as PdfDocumentLike);
    setTotalPages(parseResult.pageCount || 1);
    setCurrentPageNum(1);
    setDocViewMode('canvas');

    setUploadProgress({
      isUploading: true,
      stagePercent: 95,
      title: 'Extracting JSON & Classifying ITR Form...',
      detail: 'Running statutoryCBDT rules engine...',
    });

    const extractionResult = await extractAndClassifyAis(parseResult.rawText);
    setStructuredData(extractionResult.structuredData);
    setItrRecommendation(extractionResult.itrRecommendation);
    setIsEligibleForItr1(
      extractionResult.itrRecommendation?.recommendedForm === 'ITR-1'
    );

    return { rawText: parseResult.rawText, extractionResult };
  };

  const processJsonFile = async (file: File) => {
    setUploadProgress({
      isUploading: true,
      stagePercent: 50,
      title: 'Reading JSON Schema...',
      detail: 'Validating against developer schema contract...',
    });

    const textContent = await file.text();
    setRawText(textContent);
    setPdfDoc(null);
    setTotalPages(1);
    setCurrentPageNum(1);
    setDocViewMode('text');

    try {
      const rawParsed = JSON.parse(textContent);
      const builtData = buildJsonStructuredData(rawParsed, textContent);
      if (builtData) {
        const classified = classifyItr(builtData);
        builtData.itrRecommendation = classified;
        setStructuredData(builtData);
        setItrRecommendation(classified);
        setIsEligibleForItr1(classified.recommendedForm === 'ITR-1');
        return {
          rawText: textContent,
          extractionResult: {
            structuredData: builtData,
            itrRecommendation: classified,
          },
        };
      }
    } catch {
      // Fallback to standard extraction
    }

    const extractionResult = await extractAndClassifyAis(textContent);
    setStructuredData(extractionResult.structuredData);
    setItrRecommendation(extractionResult.itrRecommendation);
    setIsEligibleForItr1(
      extractionResult.itrRecommendation?.recommendedForm === 'ITR-1'
    );
    return { rawText: textContent, extractionResult };
  };

  const processTextOrCsvFile = async (file: File) => {
    setUploadProgress({
      isUploading: true,
      stagePercent: 50,
      title: 'Reading Document Text...',
      detail: 'Parsing layout and CSV records...',
    });

    const textContent = await file.text();
    setRawText(textContent);
    setPdfDoc(null);
    setTotalPages(1);
    setCurrentPageNum(1);
    setDocViewMode('text');

    const extractionResult = await extractAndClassifyAis(textContent);
    setStructuredData(extractionResult.structuredData);
    setItrRecommendation(extractionResult.itrRecommendation);
    setIsEligibleForItr1(
      extractionResult.itrRecommendation?.recommendedForm === 'ITR-1'
    );
    return { rawText: textContent, extractionResult };
  };

  const handleFileUpload = async (file: File) => {
    const fileName = file.name.toLowerCase();
    setUploadProgress({
      isUploading: true,
      stagePercent: 10,
      title: 'Parsing AIS Document...',
      detail: 'Reading document stream...',
    });

    try {
      let result;
      if (fileName.endsWith('.pdf') || file.type === 'application/pdf') {
        result = await processPdfFile(file);
      } else if (fileName.endsWith('.json') || file.type === 'application/json') {
        result = await processJsonFile(file);
      } else {
        result = await processTextOrCsvFile(file);
      }

      // Persist session into IndexedDB (valid for 24 hours, client-side only)
      if (result && result.extractionResult.structuredData) {
        try {
          const fileBuffer = await file.arrayBuffer();
          await saveTaxSession(
            file,
            fileBuffer,
            result.rawText,
            result.extractionResult.structuredData,
            result.extractionResult.itrRecommendation ?? undefined
          );
          setShowSessionBanner(false);
        } catch (saveErr) {
          console.warn('Failed to save session to storage:', saveErr);
        }
      }

      triggerConfetti();
      showToast('AIS extracted successfully!', 'success');
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error parsing document:', error);
      showToast(`Failed to parse document: ${errorMsg}`, 'error', 4000);
    } finally {
      setUploadProgress((prev) => ({ ...prev, isUploading: false }));
    }
  };

  const resetToFreshUpload = () => {
    setAisModalOpen(false);
    setRawText('');
    setPdfDoc(null);
    setStructuredData(null);
    setItrRecommendation(null);
    setCurrentPageNum(1);
    if (fileInputRef.current) fileInputRef.current.value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('Ready for new upload', 'info', 2000);
  };

  // --------------------------------------------------------------------------
  // Auto-Restoration Pipeline on Mount
  // --------------------------------------------------------------------------
  useEffect(() => {
    const checkAndRestore = async () => {
      try {
        const session = await loadTaxSession();
        if (!session) return;

        setRawText(session.rawText);
        setStructuredData(session.structuredData);
        const recommendation =
          session.itrRecommendation ??
          session.structuredData.itrRecommendation ??
          (session.structuredData ? classifyItr(session.structuredData) : null);
        setItrRecommendation(recommendation);
        setIsEligibleForItr1(recommendation?.recommendedForm === 'ITR-1');
        setCurrentPageNum(1);

        const isPdf =
          session.fileName.toLowerCase().endsWith('.pdf') ||
          session.fileType === 'application/pdf';
        if (isPdf && session.fileBuffer && session.fileBuffer.byteLength > 0) {
          try {
            const parseResult = await parsePdfDocument(
              session.fileBuffer,
              () => { }
            );
            setPdfDoc(parseResult.pdfDoc as PdfDocumentLike);
            setTotalPages(parseResult.pageCount || 1);
            setDocViewMode('canvas');
          } catch (pdfErr) {
            console.warn(
              'Could not re-initialize PDF canvas from stored buffer:',
              pdfErr
            );
            setPdfDoc(null);
            setDocViewMode('text');
          }
        } else {
          setPdfDoc(null);
          setDocViewMode('text');
        }

        const remainingStr = formatRemainingTime(session.expiresAt);
        setSessionExpiresText(
          `Valid for another ${remainingStr} (expires 24h from original upload or when replaced).`
        );
        setShowSessionBanner(true);
        showToast('Previous session restored from local storage', 'info', 3000);
      } catch (err) {
        console.warn('Error auto-restoring session:', err);
      }
    };

    void checkAndRestore();
  }, [showToast]);

  // --------------------------------------------------------------------------
  // Helpers for Extracted Data Presentation
  // --------------------------------------------------------------------------
  const ais = structuredData?.extraction || (structuredData?.aisJson ?? null);

  const partB1 = ais?.part_b1_tds_tcs_transactions || [];
  const partB2 = ais?.part_b2_sft_transactions || [];
  const partB3 = ais?.part_b3_tax_payments || [];
  const partB4 = ais?.part_b4_demand_refunds || [];

  const totalCredited = partB1.reduce(
    (sum, d) => sum + (d.total_amount_credited ?? d.total_amount ?? 0),
    0
  );
  const totalTdsDeducted = calculateTotalTdsDeducted(partB1);
  const totalSftAmount = partB2.reduce(
    (sum, s) => sum + (s.amount ?? s.transaction_amount ?? 0),
    0
  );
  const totalTaxPaid = partB3.reduce(
    (sum, ch) => sum + (ch.tax_amount ?? ch.total_challan_amount ?? 0),
    0
  );
  const totalRefundAmount = partB4.reduce(
    (sum, r) => sum + (r.amount ?? r.refund_amount ?? 0),
    0
  );

  const openModalWithSection = (sectionId: string) => {
    setModalTargetSection(sectionId);
    setAisModalOpen(true);
  };

  const handleItrFormChanged = useCallback(
    (_effectiveForm: string, isEligible: boolean) => {
      setIsEligibleForItr1(isEligible);
    },
    []
  );

  return (
    <div className="app-wrapper">
      {/* Top Navigation Header */}
      <header className="app-header">
        <div className="header-container">
          <div className="brand-group">
            <div className="brand-icon-wrapper">
              <ShieldCheck className="brand-icon" size={24} />
            </div>
            <div className="brand-text">
              <h1 className="brand-title">
                AIS <span className="brand-subtext">Tax Engine</span>
              </h1>
              <span className="brand-tagline">
                Annual Information Statement (AIS / 26AS)
              </span>
            </div>
          </div>

          <div className="header-actions">
            <div className="engine-badge">
              <span className="pulse-dot"></span>
              <span>100% In-Browser Privacy</span>
            </div>

            <button
              id="themeToggleBtn"
              type="button"
              className="btn btn-icon"
              title="Toggle Theme"
              aria-label="Toggle Theme"
              onClick={toggleTheme}
            >
              {theme === 'dark' ? (
                <Sun className="sun-icon" size={18} />
              ) : (
                <Moon className="moon-icon" size={18} />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="main-container">
        {/* Upload Section (Visible on fresh state) */}
        {!structuredData && (
          <section id="uploadSection" className="hero-section">
            <div className="hero-badge">
              <FileCheck className="hero-badge-icon" size={16} />
              <span>Income Tax Department &bull; AIS &amp; Form 26AS Extraction</span>
            </div>
            <h2 className="hero-heading">
              Extract <span className="text-gradient">Part A &amp; Part B</span>{' '}
              from AIS
            </h2>
            <p className="hero-subheading">
              Upload your Annual Information Statement (AIS) in{' '}
              <strong>PDF, TXT, CSV, or JSON</strong> format. Automatically
              extracts assessee profile, TDS/TCS records, and tax payment
              challans.
            </p>

            {/* Dropzone Card */}
            <div
              id="dropZone"
              className={`dropzone-card ${isDragOver ? 'drag-over' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  void handleFileUpload(file);
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                id="fileInput"
                accept=".pdf,.txt,.csv,.json"
                className="file-input-hidden"
                aria-label="Upload AIS document (PDF, TXT, CSV, or JSON)"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void handleFileUpload(file);
                  }
                }}
              />

              <div className="dropzone-content">
                <div className="upload-icon-pulse">
                  <FileUp className="upload-icon" size={32} />
                </div>

                <h3 className="dropzone-title">
                  Drop your AIS file here, or{' '}
                  <span className="browse-link">browse files</span>
                </h3>
                <p className="dropzone-hint">
                  Supports <strong>PDF, TXT, CSV, and JSON</strong> files. Zero
                  server uploads &bull; 100% Client-side.
                </p>

                <div className="upload-format-badges">
                  <span className="format-pill">
                    <FileText className="format-icon" size={14} /> PDF (AIS)
                  </span>
                  <span className="format-pill">
                    <AlignLeft className="format-icon" size={14} /> Text Layout
                    (.txt)
                  </span>
                  <span className="format-pill">
                    <Table className="format-icon" size={14} /> CSV Records
                    (.csv)
                  </span>
                  <span className="format-pill">
                    <Code className="format-icon" size={14} /> JSON Schema (.json)
                  </span>
                </div>
              </div>

              {/* Upload / Processing Progress Overlay */}
              {uploadProgress.isUploading && (
                <div id="uploadProgressOverlay" className="progress-overlay">
                  <div className="spinner-ring"></div>
                  <h4 id="progressStatusTitle" className="progress-title">
                    {uploadProgress.title}
                  </h4>
                  <div className="progress-bar-track">
                    <div
                      id="progressBarFill"
                      className="progress-bar-fill"
                      style={{ width: `${uploadProgress.stagePercent}%` }}
                    ></div>
                  </div>
                  <p id="progressStatusDetail" className="progress-detail">
                    {uploadProgress.detail}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Extraction Results Workspace (Visible after upload) */}
        {structuredData && (
          <section id="resultsWorkspace" className="results-workspace">
            {/* Restored Session Banner */}
            {showSessionBanner && (
              <div id="sessionRestoredBanner" className="session-restored-banner">
                <div className="session-banner-content">
                  <Clock className="session-banner-icon" size={20} />
                  <div>
                    <span className="session-banner-title">
                      Session Restored from Secure Local Storage
                    </span>
                    <span id="sessionExpiresText" className="session-banner-subtitle">
                      {sessionExpiresText}
                    </span>
                  </div>
                </div>
                <div className="session-banner-actions">
                  <button
                    type="button"
                    id="btnClearSession"
                    className="btn btn-secondary btn-xs"
                    title="Clear saved session data"
                    onClick={async () => {
                      await clearTaxSession();
                      resetToFreshUpload();
                      setShowSessionBanner(false);
                      showToast(
                        'Saved session cleared from local storage',
                        'info',
                        2500
                      );
                    }}
                  >
                    <Trash2 className="btn-icon-xs" size={12} />
                    <span>Clear Session</span>
                  </button>
                  <button
                    type="button"
                    id="btnDismissSessionBanner"
                    className="btn btn-ghost btn-xs"
                    title="Dismiss notice"
                    onClick={() => setShowSessionBanner(false)}
                  >
                    <X className="btn-icon-xs" size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Document Meta Header Banner */}
            <div className="document-banner">
              <div className="doc-header-info">
                <div className="doc-badge-cluster">
                  <span className="doc-type-badge">
                    <FileText className="badge-icon" size={14} />
                    <span id="docFormatBadge">
                      {pdfDoc ? 'AIS PDF' : 'AIS Document'}
                    </span>
                  </span>
                  <span className="confidence-badge">
                    <ShieldCheck className="badge-icon" size={14} />
                    <span id="confidenceText">Verified Tax Record</span>
                  </span>
                  <span className="meta-pill">
                    <Calendar className="badge-icon" size={14} />
                    <span id="taxYearBannerBadge">
                      {formatPeriodBanner(ais)}
                    </span>
                  </span>
                </div>
                <h2 id="docTitleHeading" className="doc-title-heading">
                  Annual Information Statement (AIS)
                </h2>
                <p id="docSummaryText" className="doc-summary-text">
                  Assessee:{' '}
                  {ais?.part_a_general_info?.name_of_assessee || 'Assessee'} (PAN:{' '}
                  {ais?.part_a_general_info?.pan || '—'}), {partB1.length} TDS
                  Deductor source(s), {partB3.length} Tax Payment challan(s)
                  extracted.
                </p>
              </div>

              <div className="doc-header-actions">
                <button
                  type="button"
                  id="reuploadBtn"
                  className="btn btn-secondary btn-sm"
                  title="Upload another document"
                  onClick={resetToFreshUpload}
                >
                  <Upload className="btn-icon-sm" size={16} />
                  <span>Upload Another File</span>
                </button>
              </div>
            </div>

            {/* Floating Side Action Button for AIS Modal */}
            <button
              type="button"
              id="btnFloatingAis"
              className="ais-side-action-btn"
              title="Show AIS Summary (Part A & Part B)"
              onClick={() => {
                setModalTargetSection(null);
                setAisModalOpen(true);
              }}
            >
              <LayoutDashboard className="side-btn-icon" size={18} />
              <span>Show AIS</span>
            </button>

            {/* KPI Metrics Grid: Paired Primary KPI with Part B Category Navigator */}
            <div className="kpi-metrics-grid kpi-metrics-grid--paired">
              {/* KPI Card 1: Total Amount Credited */}
              <div className="kpi-card kpi-card--primary">
                <div className="kpi-icon-wrap kpi-emerald">
                  <Wallet className="kpi-icon" size={24} />
                </div>
                <div className="kpi-content">
                  <span className="kpi-label">Total Amount Credited</span>
                  <h3 id="kpiTotalCredited" className="kpi-value">
                    {formatInr(totalCredited)}
                  </h3>
                  <span className="kpi-subtext">
                    Cumulative gross receipts across Part B1 deductors
                  </span>
                </div>
              </div>

              {/* KPI Card 2: Part B Category Navigator Card */}
              <div className="kpi-card kpi-card--part-b-nav">
                <div className="part-b-nav-header">
                  <div className="part-b-nav-title-wrap">
                    <Layers className="part-b-nav-icon" size={18} />
                    <span className="part-b-nav-title">Part B Schedules</span>
                  </div>
                  <button
                    type="button"
                    id="btnNavOpenAllModal"
                    className="btn btn-secondary btn-xs"
                    title="Open Complete AIS Modal (Part A & Part B)"
                    onClick={() => {
                      setModalTargetSection(null);
                      setAisModalOpen(true);
                    }}
                  >
                    <LayoutDashboard className="btn-icon-xs" size={14} />
                    <span>Open Full AIS</span>
                  </button>
                </div>

                <div className="part-b-nav-grid">
                  {/* Item B1: TDS / TCS */}
                  <div className="part-b-nav-item">
                    <button
                      type="button"
                      className="part-b-nav-btn"
                      title="View Part B1 TDS/TCS Details in Modal Window"
                      onClick={() => openModalWithSection('modalSectionPartB1')}
                    >
                      <Receipt
                        className="part-b-item-icon part-b-icon-sky"
                        size={16}
                      />
                      <span className="part-b-item-label">
                        Part B1: TDS / TCS
                      </span>
                      <ArrowUpRight
                        className="part-b-item-arrow"
                        size={14}
                      />
                    </button>
                    <div className="part-b-nav-metric">
                      <span
                        className="part-b-nav-amount text-brand"
                        id="kpiB1TdsAmount"
                        title="Total eligible TDS deducted across active transactions valid for tax return credit"
                      >
                        {formatInr(totalTdsDeducted)}
                      </span>
                      <span className="part-b-nav-meta" id="kpiB1Count">
                        TDS Deducted ({partB1.length} source
                        {partB1.length === 1 ? '' : 's'})
                      </span>
                    </div>
                  </div>

                  {/* Item B2: SFT Transactions */}
                  <div className="part-b-nav-item">
                    <button
                      type="button"
                      className="part-b-nav-btn"
                      title="View Part B2 SFT Details in Modal Window"
                      onClick={() => openModalWithSection('modalSectionPartB2')}
                    >
                      <TrendingUp
                        className="part-b-item-icon part-b-icon-violet"
                        size={16}
                      />
                      <span className="part-b-item-label">Part B2: SFT</span>
                      <ArrowUpRight
                        className="part-b-item-arrow"
                        size={14}
                      />
                    </button>
                    <div className="part-b-nav-metric">
                      <span className="part-b-nav-amount" id="kpiB2Amount">
                        {formatInr(totalSftAmount)}
                      </span>
                      <span className="part-b-nav-meta" id="kpiB2Count">
                        {partB2.length} SFT record
                        {partB2.length === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>

                  {/* Item B3: Tax Payments (Challans) */}
                  <div className="part-b-nav-item">
                    <button
                      type="button"
                      className="part-b-nav-btn"
                      title="View Part B3 Tax Payment Challans in Modal Window"
                      onClick={() => openModalWithSection('modalSectionPartB3')}
                    >
                      <CreditCard
                        className="part-b-item-icon part-b-icon-emerald"
                        size={16}
                      />
                      <span className="part-b-item-label">
                        Part B3: Tax Payments
                      </span>
                      <ArrowUpRight
                        className="part-b-item-arrow"
                        size={14}
                      />
                    </button>
                    <div className="part-b-nav-metric">
                      <span className="part-b-nav-amount" id="kpiB3Amount">
                        {formatInr(totalTaxPaid)}
                      </span>
                      <span className="part-b-nav-meta" id="kpiB3Count">
                        Tax Paid ({partB3.length} challan
                        {partB3.length === 1 ? '' : 's'})
                      </span>
                    </div>
                  </div>

                  {/* Item B4: Demand & Refund */}
                  <div className="part-b-nav-item">
                    <button
                      type="button"
                      className="part-b-nav-btn"
                      title="View Part B4 Demand & Refund in Modal Window"
                      onClick={() => openModalWithSection('modalSectionPartB4')}
                    >
                      <BadgeDollarSign
                        className="part-b-item-icon part-b-icon-amber"
                        size={16}
                      />
                      <span className="part-b-item-label">
                        Part B4: Demand / Refund
                      </span>
                      <ArrowUpRight
                        className="part-b-item-arrow"
                        size={14}
                      />
                    </button>
                    <div className="part-b-nav-metric">
                      <span className="part-b-nav-amount" id="kpiB4Amount">
                        {formatInr(totalRefundAmount)}
                      </span>
                      <span className="part-b-nav-meta" id="kpiB4Count">
                        {partB4.length} record
                        {partB4.length === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Statutory ITR Form Classification & Advisory Section (Main Page) */}
            <div className="main-itr-advisor-wrapper">
              <AisItrAdvisor
                id="aisItrAdvisorEl"
                data={itrRecommendation}
                onItrFormChanged={handleItrFormChanged}
              />
            </div>

            {/* Dual-Regime Tax Calculator & Optimizer (ITR-1 Category Only - Main Page) */}
            <div id="mainTaxCalcWrapper" className="main-tax-calc-wrapper">
              <AisTaxCalculator
                id="aisTaxCalcEl"
                data={ais}
                isEligibleForItr1={isEligibleForItr1}
              />
            </div>

            {/* Main Workspace Document Viewer Card */}
            <PdfViewer
              pdfDoc={pdfDoc}
              rawText={rawText}
              currentPageNum={currentPageNum}
              totalPages={totalPages}
              zoom={zoom}
              viewMode={docViewMode}
              onViewModeChange={setDocViewMode}
              onPageChange={setCurrentPageNum}
              onZoomChange={setZoom}
              onOpenAisModal={() => {
                setModalTargetSection(null);
                setAisModalOpen(true);
              }}
            />
          </section>
        )}
      </main>

      {/* AIS Part A & Part B Modal Window */}
      <AisDetailsModal
        isOpen={aisModalOpen}
        onClose={() => {
          setAisModalOpen(false);
          setModalTargetSection(null);
        }}
        data={ais}
        targetSectionId={modalTargetSection}
      />

      {/* Password Modal for Protected PDFs */}
      <PasswordModal
        isOpen={passwordModalOpen}
        isRetry={passwordModalRetry}
        onSubmit={handlePasswordSubmit}
        onCancel={handlePasswordCancel}
      />

      {/* Floating Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-container">
          <p className="footer-text">
            AIS &copy; 2026. Annual Information Statement Extraction Engine.
          </p>
          <div className="footer-links">
            <span>Zero Server Uploads</span>
            <span>&bull;</span>
            <span>100% Private In-Browser</span>
            <span>&bull;</span>
            <span>AIS / 26AS Compliant</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
