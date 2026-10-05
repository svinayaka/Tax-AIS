import { createIcons, icons } from 'lucide';
import confetti from 'canvas-confetti';

import { parsePdfDocument, renderPageToCanvas } from './lib/pdf-parser';
import { extractStructuredData } from './lib/extractor';
import { SAMPLE_DOCUMENTS } from './lib/sample-data';

// Import Siddi-compliant Stencil / Web Components
import './components/index';
import { AisPartA } from './components/ais-part-a';
import { AisTaxPaymentCard } from './components/ais-tax-payment-card';
import { AisDeveloperSchema, StructuredExtractionResult } from './types/ais';

// ==========================================================================
// Application State Interface & Object
// ==========================================================================
interface AppState {
  theme: string;
  currentFile: File | { name: string; type?: string } | null;
  rawText: string;
  pdfDoc: any;
  currentPageNum: number;
  totalPages: number;
  currentZoom: number;
  structuredData: StructuredExtractionResult | null;
  activeTab: string;
  docViewMode: 'canvas' | 'text';
}

const state: AppState = {
  theme: localStorage.getItem('ais_theme') || 'dark',
  currentFile: null,
  rawText: '',
  pdfDoc: null,
  currentPageNum: 1,
  totalPages: 1,
  currentZoom: 1.5, // Default 150% for high readability
  structuredData: null,
  activeTab: 'aisview',
  docViewMode: 'canvas',
};

// Initialize Icons Helper
function refreshIcons(): void {
  createIcons({ icons });
}

// ==========================================================================
// Toast Notification Engine
// ==========================================================================
function showToast(message: string, type: 'info' | 'success' | 'error' = 'info', duration: number = 3000): void {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  const iconMap: Record<string, string> = {
    success: 'check-circle',
    error: 'alert-circle',
    info: 'shield-check',
  };
  const iconName = iconMap[type] || 'shield-check';
  toast.innerHTML = `
    <i data-lucide="${iconName}" class="toast-icon"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  refreshIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

// ==========================================================================
// Theme Management
// ==========================================================================
function initTheme(): void {
  document.documentElement.setAttribute('data-theme', state.theme);
  document.documentElement.setAttribute('data-ksv-ds-theme', state.theme);
  const toggleBtn = document.getElementById('themeToggleBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', state.theme);
      document.documentElement.setAttribute('data-ksv-ds-theme', state.theme);
      localStorage.setItem('ais_theme', state.theme);
      showToast(`Switched to ${state.theme} theme`, 'info', 2000);
    });
  }
}

// ==========================================================================
// PDF Password Handling
// ==========================================================================
let pendingPasswordResolver: { resolve: (password: string | null) => void } | null = null;

function promptForPdfPassword(isRetry: boolean = false): Promise<string | null> {
  return new Promise((resolve) => {
    const backdrop = document.getElementById('passwordModalBackdrop');
    const input = document.getElementById('aisPasswordInput') as HTMLInputElement | null;
    const errorMsg = document.getElementById('passwordErrorMsg');
    
    if (!backdrop || !input) {
      resolve(null);
      return;
    }

    if (isRetry && errorMsg) {
      errorMsg.classList.remove('hidden');
    } else if (errorMsg) {
      errorMsg.classList.add('hidden');
    }

    input.value = '';
    backdrop.classList.remove('hidden');
    input.focus();

    pendingPasswordResolver = { resolve };
  });
}

function closePasswordModal(cancelled: boolean = false): void {
  const backdrop = document.getElementById('passwordModalBackdrop');
  if (backdrop) backdrop.classList.add('hidden');
  if (pendingPasswordResolver) {
    if (cancelled) {
      pendingPasswordResolver.resolve(null);
    }
    pendingPasswordResolver = null;
  }
}

// ==========================================================================
// File Ingestion & Extraction Orchestrator (PDF, TXT, CSV, JSON)
// ==========================================================================
async function handleFileUpload(file: File): Promise<void> {
  const fileName = file.name.toLowerCase();
  const overlay = document.getElementById('uploadProgressOverlay');
  const fill = document.getElementById('progressBarFill');
  const title = document.getElementById('progressStatusTitle');
  const detail = document.getElementById('progressStatusDetail');

  if (overlay) overlay.classList.remove('hidden');

  try {
    if (fileName.endsWith('.pdf') || file.type === 'application/pdf') {
      // 1. PDF File Processing
      const parseResult = await parsePdfDocument(
        file,
        ({ stage, percent, message }) => {
          if (fill) fill.style.width = `${percent}%`;
          if (detail) detail.textContent = message;
          if (title) {
            if (stage === 'loading') title.textContent = 'Reading AIS PDF Binary...';
            if (stage === 'parsing') title.textContent = 'Extracting Layout Stream...';
            if (stage === 'extracting') title.textContent = 'Parsing Part A & Part B...';
            if (stage === 'finishing') title.textContent = 'Sanitizing PII & Finalizing...';
          }
        },
        null,
        promptForPdfPassword
      );

      state.currentFile = file;
      state.rawText = parseResult.rawText;
      state.pdfDoc = parseResult.pdfDoc;
      state.totalPages = parseResult.pageCount || 1;
      state.currentPageNum = 1;

      state.structuredData = extractStructuredData(parseResult.rawText);

      // Render First Page to Canvas
      if (state.pdfDoc) {
        const page = await state.pdfDoc.getPage(1);
        const canvas = document.getElementById('pdfPageCanvas') as HTMLCanvasElement | null;
        document.getElementById('pdfNoPreviewMessage')?.classList.add('hidden');
        if (canvas) {
          canvas.classList.remove('hidden');
          await renderPageToCanvas(page, canvas, state.currentZoom);
        }
        updatePdfNavControls();
      }

    } else if (fileName.endsWith('.json') || file.type === 'application/json') {
      // 2. JSON File Processing
      if (fill) fill.style.width = '50%';
      if (title) title.textContent = 'Reading JSON Schema...';
      const textContent = await file.text();
      state.currentFile = file;
      state.rawText = textContent;
      state.pdfDoc = null;
      state.totalPages = 1;
      state.currentPageNum = 1;

      try {
        const parsedJson = JSON.parse(textContent);
        if (parsedJson.part_a_general_info || parsedJson.part_b1_tds_tcs_transactions) {
          state.structuredData = {
            documentClassification: {
              type: 'ais',
              confidence: 'high',
              score: 98,
              label: 'Annual Information Statement (AIS - Form 168)',
              icon: 'file-text',
              themeColor: 'var(--ksv-ds-color-indigo-500)'
            },
            summary: {
              overview: `Annual Information Statement for Tax Year ${parsedJson.tax_year || '2026-27'}`,
              keyHighlights: [],
              completeness: 'Complete'
            },
            metadata: {
              extractionDurationMs: 5,
              characterCount: textContent.length,
              wordCount: textContent.split(/\s+/).length,
              lineCount: textContent.split('\n').length,
              confidenceScore: 98,
              extractedAt: new Date().toISOString()
            },
            keyValues: {},
            flatKeyValues: [],
            entities: { emails: [], phones: [], urls: [], dates: [], monetaryAmounts: [], identifiers: [], organizations: [] },
            tables: [],
            sections: [],
            customFieldResults: {},
            aisJson: parsedJson
          };
        } else {
          state.structuredData = extractStructuredData(textContent);
        }
      } catch {
        state.structuredData = extractStructuredData(textContent);
      }

    } else {
      // 3. Text or CSV File Processing
      if (fill) fill.style.width = '50%';
      if (title) title.textContent = 'Reading Document Text...';
      const textContent = await file.text();
      state.currentFile = file;
      state.rawText = textContent;
      state.pdfDoc = null;
      state.totalPages = 1;
      state.currentPageNum = 1;

      state.structuredData = extractStructuredData(textContent);
    }

    // Update Views
    renderAllViews(file.name);

    // Hide PDF canvas if not a PDF file
    const canvas = document.getElementById('pdfPageCanvas');
    const placeholder = document.getElementById('pdfNoPreviewMessage');
    if (!state.pdfDoc) {
      if (canvas) canvas.classList.add('hidden');
      if (placeholder) placeholder.classList.remove('hidden');
      setDocViewMode('text');
    } else {
      setDocViewMode('canvas');
    }

    // Success celebration
    triggerConfetti();
    showToast('AIS extracted successfully!', 'success');

  } catch (error: any) {
    console.error('Error parsing document:', error);
    showToast(`Failed to parse document: ${error?.message || 'Unknown error'}`, 'error', 4000);
  } finally {
    if (overlay) overlay.classList.add('hidden');
  }
}

// Sample Loader for Testing
async function loadSampleAis(): Promise<void> {
  const overlay = document.getElementById('uploadProgressOverlay');
  const fill = document.getElementById('progressBarFill');
  const title = document.getElementById('progressStatusTitle');
  const detail = document.getElementById('progressStatusDetail');

  if (overlay) overlay.classList.remove('hidden');
  if (fill) fill.style.width = '30%';
  if (title) title.textContent = 'Loading Reference AIS File...';
  if (detail) detail.textContent = 'Extracting Part A & Part B...';

  try {
    const response = await fetch('/src/assets/XXXPV2797X_2026-27_AIS_unlocked.pdf');
    if (response.ok) {
      const blob = await response.blob();
      const file = new File([blob], 'XXXPV2797X_2026-27_AIS_unlocked.pdf', { type: 'application/pdf' });
      await handleFileUpload(file);
      return;
    }
  } catch (e) {
    console.warn('Direct asset fetch fallback:', e);
  }

  // Fallback to sample text
  const sample = SAMPLE_DOCUMENTS.find(s => s.id === 'ais') || SAMPLE_DOCUMENTS[0];
  state.currentFile = { name: 'AIS_Reference_2026-27.txt', type: 'text/plain' };
  state.rawText = sample.rawText;
  state.pdfDoc = null;
  state.totalPages = 1;
  state.currentPageNum = 1;
  state.structuredData = extractStructuredData(sample.rawText);

  renderAllViews('AIS_Reference_2026-27.txt');
  setDocViewMode('text');
  if (overlay) overlay.classList.add('hidden');

  triggerConfetti();
  showToast('Loaded Reference AIS Sample!', 'success');
}

function resetToFreshUpload(): void {
  state.currentFile = null;
  state.rawText = '';
  state.pdfDoc = null;
  state.structuredData = null;
  state.currentPageNum = 1;

  // Show upload section, hide results
  document.getElementById('uploadSection')?.classList.remove('hidden');
  document.getElementById('resultsWorkspace')?.classList.add('hidden');

  const fileInput = document.getElementById('fileInput') as HTMLInputElement | null;
  if (fileInput) fileInput.value = '';

  window.scrollTo({ top: 0, behavior: 'smooth' });
  showToast('Ready for new upload', 'info', 2000);
}

function triggerConfetti(): void {
  confetti({
    particleCount: 50,
    spread: 60,
    origin: { y: 0.7 },
    colors: ['#6366f1', '#a855f7', '#10b981', '#3b82f6']
  });
}

// ==========================================================================
// Rendering Pipeline
// ==========================================================================
function renderAllViews(_fileName: string): void {
  const data = state.structuredData;
  if (!data) return;

  const ais = data.aisJson || {} as AisDeveloperSchema;
  const partA = ais.part_a_general_info || { name_of_assessee: '', pan: '' };
  const partB1 = ais.part_b1_tds_tcs_transactions || [];
  const partB3 = ais.part_b3_tax_payments || [];

  // Reveal Workspace & Hide Upload Screen
  document.getElementById('uploadSection')?.classList.add('hidden');
  const workspace = document.getElementById('resultsWorkspace');
  if (workspace) {
    workspace.classList.remove('hidden');
    workspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // 1. Header Banner
  const titleEl = document.getElementById('docTitleHeading');
  const yearEl = document.getElementById('taxYearBannerBadge');
  const summaryEl = document.getElementById('docSummaryText');
  const formatBadge = document.getElementById('docFormatBadge');

  if (titleEl) titleEl.textContent = `Annual Information Statement (AIS)`;
  if (yearEl) yearEl.textContent = `Tax Year: ${ais.tax_year || '2026-27'}`;
  if (formatBadge) {
    formatBadge.textContent = state.pdfDoc ? 'AIS PDF (Form 168)' : 'AIS Document';
  }
  if (summaryEl) {
    summaryEl.textContent = `Assessee: ${partA.name_of_assessee || 'Assessee'} (PAN: ${partA.pan || '—'}), ${partB1.length} TDS Deductor source(s), ${partB3.length} Tax Payment challan(s) extracted.`;
  }

  // 2. Render KPI Cards
  const totalCredited = partB1.reduce((sum, d) => sum + (d.total_amount_credited || d.total_amount || 0), 0);
  const totalTaxPaid = partB3.reduce((sum, ch) => sum + (ch.tax_amount || 0), 0);

  const kpiCount = document.getElementById('kpiTdsCount');
  const kpiCredited = document.getElementById('kpiTotalCredited');
  const kpiPaid = document.getElementById('kpiTaxPaid');

  if (kpiCount) kpiCount.textContent = String(partB1.length);
  if (kpiCredited) kpiCredited.textContent = `₹${totalCredited.toLocaleString('en-IN')}`;
  if (kpiPaid) kpiPaid.textContent = `₹${totalTaxPaid.toLocaleString('en-IN')}`;

  // 3. Render AIS Dashboard (Part A & Part B)
  renderAisDashboard(ais);

  // 4. Populate Document Text Stream
  const rawTextDisplay = document.getElementById('rawTextDisplay');
  if (rawTextDisplay) {
    rawTextDisplay.textContent = state.rawText;
  }

  refreshIcons();
}

/**
 * Render Ultra-Elegant AIS Tax Intelligence Dashboard
 */
function renderAisDashboard(ais: AisDeveloperSchema): void {
  const container = document.getElementById('aisDashboardContainer');
  if (!container) return;

  const partA = ais.part_a_general_info || {} as any;
  const partB1 = ais.part_b1_tds_tcs_transactions || [];
  const partB2 = ais.part_b2_sft_transactions || [];
  const partB3 = ais.part_b3_tax_payments || [];
  const partB4 = ais.part_b4_demand_refunds || [];

  let html = `
    <div class="ais-dashboard-wrapper">
      
      <!-- Assessee Info Banner -->
      <div class="ais-pii-banner">
        <div class="ais-pii-info">
          <i data-lucide="shield-check" class="ais-pii-icon"></i>
          <div>
            <h4 class="ais-pii-title">Annual Information Statement (AIS - Form 168)</h4>
            <p class="ais-pii-desc">Assessee profile (Part A) and tax transaction breakdown (Part B) extracted directly from Income Tax Department document.</p>
          </div>
        </div>
        <span class="ais-pii-badge">
          <i data-lucide="check-circle" class="btn-icon-xs"></i>
          Verified Tax Record
        </span>
      </div>

      <!-- PART A: General Information Web Component -->
      <ais-part-a tax-year="${escapeHtml(ais.tax_year || '2026-27')}"></ais-part-a>

      <!-- PART B1: TDS / TCS Transactions -->
      <div class="ais-part-section">
        <div class="ais-part-header">
          <div class="ais-part-title-wrap">
            <i data-lucide="receipt" class="ais-part-icon" style="color:var(--ksv-ds-color-sky-500);"></i>
            <h3 class="ais-part-title">Part B1 — Tax Deducted or Collected at Source (TDS / TCS)</h3>
          </div>
          <span class="meta-pill">${partB1.length} Deductor Source(s)</span>
        </div>

        <div class="ais-deductors-container">
          ${partB1.length > 0 ? partB1.map((deductor) => `
            <div class="ais-deductor-block">
              <div class="ais-deductor-header">
                <div>
                  <div class="ais-deductor-name">${escapeHtml(deductor.information_source)}</div>
                  <div class="ais-deductor-meta">
                    <strong>Code:</strong> ${escapeHtml(deductor.information_code)} &bull; ${escapeHtml(deductor.information_description)}
                  </div>
                </div>
                <div class="ais-deductor-metrics">
                  <div class="ais-metric-pill">
                    <span class="ais-metric-label">Total Amount Credited</span>
                    <span class="ais-metric-val">₹${(deductor.total_amount_credited || deductor.total_amount || 0).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              <!-- Nested Quarterly Line Items -->
              <div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Quarter</th>
                      <th>Date of Payment / Credit</th>
                      <th>Amount Paid / Credited</th>
                      <th>TDS Deducted</th>
                      <th>TDS Deposited</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(deductor.line_items || []).map((item, idx) => `
                      <tr>
                        <td>${item.sr_no || idx + 1}</td>
                        <td><span class="meta-pill" style="font-size:0.75rem;">${escapeHtml(item.quarter)}</span></td>
                        <td>${escapeHtml(item.date_of_payment)}</td>
                        <td><strong>₹${Number(item.amount_paid_credited).toLocaleString('en-IN')}</strong></td>
                        <td style="color:var(--ksv-ds-status-warning-icon); font-weight:600;">₹${Number(item.tds_deducted).toLocaleString('en-IN')}</td>
                        <td style="color:var(--ksv-ds-status-success-icon); font-weight:600;">₹${Number(item.tds_deposited).toLocaleString('en-IN')}</td>
                        <td>
                          <span class="status-pill-active">
                            <i data-lucide="check-circle-2" class="btn-icon-xs"></i>
                            ${escapeHtml(item.status || 'Active')}
                          </span>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          `).join('') : `
            <div class="ais-empty-part">
              <i data-lucide="info" class="btn-icon-sm"></i>
              <span>No TDS / TCS transactions recorded for this period.</span>
            </div>
          `}
        </div>
      </div>

      <!-- PART B2: SFT Transactions -->
      <div class="ais-part-section">
        <div class="ais-part-header">
          <div class="ais-part-title-wrap">
            <i data-lucide="trending-up" class="ais-part-icon" style="color:var(--ksv-ds-color-violet-500);"></i>
            <h3 class="ais-part-title">Part B2 — Specified Financial Transactions (SFT)</h3>
          </div>
          <span class="meta-pill">${partB2.length} Records</span>
        </div>

        ${partB2.length > 0 ? `
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Code</th>
                  <th>Description</th>
                  <th>Source / Reporting Entity</th>
                  <th>Amount</th>
                  <th>Transaction Date</th>
                </tr>
              </thead>
              <tbody>
                ${partB2.map((sft, idx) => `
                  <tr>
                    <td>${sft.sr_no || idx + 1}</td>
                    <td><span class="meta-pill">${escapeHtml(sft.information_code)}</span></td>
                    <td>${escapeHtml(sft.information_description)}</td>
                    <td>${escapeHtml(sft.information_source)}</td>
                    <td><strong>₹${Number(sft.amount || sft.transaction_amount).toLocaleString('en-IN')}</strong></td>
                    <td>${escapeHtml(sft.transaction_date)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="ais-empty-part">
            <i data-lucide="check-circle" class="btn-icon-sm" style="color:var(--ksv-ds-status-success-icon);"></i>
            <span>No Specified Financial Transactions (SFT) present in this Tax Year.</span>
          </div>
        `}
      </div>

      <!-- PART B3: Payment of Taxes Web Component -->
      <ais-tax-payment-card></ais-tax-payment-card>

      <!-- PART B4: Demand and Refund -->
      <div class="ais-part-section">
        <div class="ais-part-header">
          <div class="ais-part-title-wrap">
            <i data-lucide="badge-dollar-sign" class="ais-part-icon" style="color:var(--ksv-ds-color-amber-500);"></i>
            <h3 class="ais-part-title">Part B4 — Information Relating to Demand and Refund</h3>
          </div>
          <span class="meta-pill">${partB4.length} Records</span>
        </div>

        ${partB4.length > 0 ? `
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Financial Year</th>
                  <th>Nature of Refund</th>
                  <th>Refund Amount</th>
                  <th>Date of Payment</th>
                </tr>
              </thead>
              <tbody>
                ${partB4.map((ref) => `
                  <tr>
                    <td>${escapeHtml(ref.financial_year || ref.assessment_year || '')}</td>
                    <td>${escapeHtml(ref.nature_of_refund || ref.nature || '')}</td>
                    <td><strong>₹${Number(ref.refund_amount || ref.amount).toLocaleString('en-IN')}</strong></td>
                    <td>${escapeHtml(ref.date_of_payment || ref.date_of_issuance || '')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="ais-empty-part">
            <i data-lucide="check-circle" class="btn-icon-sm" style="color:var(--ksv-ds-status-success-icon);"></i>
            <span>No Demands or Refunds Present for this Tax Year.</span>
          </div>
        `}
      </div>

    </div>
  `;

  container.innerHTML = html;

  // Set reactive properties on custom elements
  const partAComp = container.querySelector('ais-part-a') as AisPartA | null;
  if (partAComp) partAComp.data = partA;

  const taxPayComp = container.querySelector('ais-tax-payment-card') as AisTaxPaymentCard | null;
  if (taxPayComp) taxPayComp.payments = partB3;

  refreshIcons();
}

// --------------------------------------------------------------------------
// PDF Canvas Page Navigation & High-DPI Zoom Controls
// --------------------------------------------------------------------------
async function changePdfPage(delta: number): Promise<void> {
  if (!state.pdfDoc) return;
  const newPage = state.currentPageNum + delta;
  if (newPage < 1 || newPage > state.totalPages) return;

  state.currentPageNum = newPage;
  await reRenderCurrentPdfPage();
  updatePdfNavControls();
}

async function reRenderCurrentPdfPage(): Promise<void> {
  if (!state.pdfDoc) return;
  const page = await state.pdfDoc.getPage(state.currentPageNum);
  const canvas = document.getElementById('pdfPageCanvas') as HTMLCanvasElement | null;
  if (canvas) {
    await renderPageToCanvas(page, canvas, state.currentZoom);
  }
}

function updatePdfNavControls(): void {
  const indicator = document.getElementById('pdfPageIndicator');
  const prevBtn = document.getElementById('prevPageBtn') as HTMLButtonElement | null;
  const nextBtn = document.getElementById('nextPageBtn') as HTMLButtonElement | null;

  if (indicator) indicator.textContent = `Page ${state.currentPageNum} of ${state.totalPages}`;
  if (prevBtn) prevBtn.disabled = state.currentPageNum <= 1;
  if (nextBtn) nextBtn.disabled = state.currentPageNum >= state.totalPages;
}

function setDocViewMode(mode: 'canvas' | 'text'): void {
  state.docViewMode = mode;
  const canvasContainer = document.getElementById('pdfCanvasContainer');
  const rawTextContainer = document.getElementById('rawTextContainer');
  const viewCanvasBtn = document.getElementById('viewCanvasBtn');
  const viewTextBtn = document.getElementById('viewTextBtn');
  const pdfNavControls = document.getElementById('pdfNavControls');
  const pdfZoomControls = document.getElementById('pdfZoomControls');

  if (mode === 'canvas') {
    canvasContainer?.classList.remove('hidden');
    rawTextContainer?.classList.add('hidden');
    viewCanvasBtn?.classList.add('active');
    viewTextBtn?.classList.remove('active');
    if (pdfNavControls) pdfNavControls.style.display = state.pdfDoc ? 'flex' : 'none';
    if (pdfZoomControls) pdfZoomControls.style.display = state.pdfDoc ? 'flex' : 'none';
  } else {
    canvasContainer?.classList.add('hidden');
    rawTextContainer?.classList.remove('hidden');
    viewCanvasBtn?.classList.remove('active');
    viewTextBtn?.classList.add('active');
    if (pdfNavControls) pdfNavControls.style.display = 'none';
    if (pdfZoomControls) pdfZoomControls.style.display = 'none';
  }
}

// ==========================================================================
// Event Listeners Setup
// ==========================================================================
function setupEventListeners(): void {
  // 1. File Dropzone & Hidden Input
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput') as HTMLInputElement | null;

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file) {
        handleFileUpload(file);
      }
    });

    ['dragenter', 'dragover'].forEach(name => {
      dropZone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      dropZone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      const dragEvent = e as DragEvent;
      const file = dragEvent.dataTransfer?.files?.[0];
      if (file) {
        handleFileUpload(file);
      }
    });
  }

  // 2. Reference AIS Sample Link
  document.getElementById('loadReferenceAisBtn')?.addEventListener('click', () => {
    loadSampleAis();
  });

  // 3. Re-Upload / Reset Button
  document.getElementById('reuploadBtn')?.addEventListener('click', () => {
    resetToFreshUpload();
  });

  // 4. Workspace Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab') || 'aisview';
      state.activeTab = tabId;

      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(`pane-${tabId}`);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // 5. Document View Switcher (PDF Canvas vs Raw Text)
  document.getElementById('viewCanvasBtn')?.addEventListener('click', () => setDocViewMode('canvas'));
  document.getElementById('viewTextBtn')?.addEventListener('click', () => setDocViewMode('text'));

  // 6. PDF Viewer Navigation
  document.getElementById('prevPageBtn')?.addEventListener('click', () => changePdfPage(-1));
  document.getElementById('nextPageBtn')?.addEventListener('click', () => changePdfPage(1));

  // 7. High-DPI Zoom Controls
  document.getElementById('zoomInBtn')?.addEventListener('click', async () => {
    if (state.currentZoom < 2.5 && state.pdfDoc) {
      state.currentZoom += 0.25;
      const zoomText = document.getElementById('zoomLevelText');
      if (zoomText) zoomText.textContent = `${Math.round(state.currentZoom * 100)}%`;
      await reRenderCurrentPdfPage();
    }
  });

  document.getElementById('zoomOutBtn')?.addEventListener('click', async () => {
    if (state.currentZoom > 0.75 && state.pdfDoc) {
      state.currentZoom -= 0.25;
      const zoomText = document.getElementById('zoomLevelText');
      if (zoomText) zoomText.textContent = `${Math.round(state.currentZoom * 100)}%`;
      await reRenderCurrentPdfPage();
    }
  });

  document.getElementById('zoomFitBtn')?.addEventListener('click', async () => {
    if (state.pdfDoc) {
      state.currentZoom = 1.6; // Optimal fit width
      const zoomText = document.getElementById('zoomLevelText');
      if (zoomText) zoomText.textContent = `${Math.round(state.currentZoom * 100)}%`;
      await reRenderCurrentPdfPage();
    }
  });

  // 8. Password Modal Controls
  const submitPassword = () => {
    const input = document.getElementById('aisPasswordInput') as HTMLInputElement | null;
    const val = input ? input.value.trim() : '';
    if (!val) {
      showToast('Please enter password (PAN + DOB)', 'error');
      return;
    }
    const backdrop = document.getElementById('passwordModalBackdrop');
    if (backdrop) backdrop.classList.add('hidden');
    if (pendingPasswordResolver) {
      pendingPasswordResolver.resolve(val);
      pendingPasswordResolver = null;
    }
  };

  document.getElementById('btnSubmitPassword')?.addEventListener('click', submitPassword);
  document.getElementById('passwordForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    submitPassword();
  });
  document.getElementById('btnCancelPasswordModal')?.addEventListener('click', () => closePasswordModal(true));
  document.getElementById('btnCancelPasswordClose')?.addEventListener('click', () => closePasswordModal(true));
  document.getElementById('btnTogglePasswordVisibility')?.addEventListener('click', () => {
    const input = document.getElementById('aisPasswordInput') as HTMLInputElement | null;
    if (!input) return;
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
  });
}

function escapeHtml(str: string | null | undefined): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==========================================================================
// Initialization (Fresh state - no auto-loading!)
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  refreshIcons();
  setupEventListeners();
});
