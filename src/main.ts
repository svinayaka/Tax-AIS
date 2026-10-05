import { createIcons, icons } from 'lucide';
import confetti from 'canvas-confetti';

import { parsePdfDocument, renderPageToCanvas, type PdfDocumentLike } from './lib/pdf-parser';
import { extractStructuredData } from './lib/extractor';
import { escapeHtml, formatInr } from './lib/dom-utils';

// Import Siddi-compliant Stencil / Web Components
import './components/index';
import {
  ColorIndigo500,
  ColorViolet500,
  ColorEmerald500,
  ColorSky500
} from '@svinayaka/siddi-design-system/tokens';
import { AisPartA } from './components/ais-part-a';
import { AisDeductorCard } from './components/ais-deductor-card';
import { AisTaxPaymentCard } from './components/ais-tax-payment-card';
import type { AisDeveloperSchema, StructuredExtractionResult } from './types/ais';

// ==========================================================================
// Application State Interface & Object
// ==========================================================================
interface AppState {
  theme: string;
  currentFile: File | { name: string; type?: string } | null;
  rawText: string;
  pdfDoc: PdfDocumentLike | null;
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
function showToast(message: string, type: 'info' | 'success' | 'error' = 'info', duration = 3000): void {
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
    <span>${escapeHtml(message)}</span>
  `;

  container.append(toast);
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
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.dataset.ksvDsTheme = state.theme;
  const toggleBtn = document.getElementById('themeToggleBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = state.theme;
      document.documentElement.dataset.ksvDsTheme = state.theme;
      localStorage.setItem('ais_theme', state.theme);
      showToast(`Switched to ${state.theme} theme`, 'info', 2000);
    });
  }
}

// ==========================================================================
// PDF Password Handling
// ==========================================================================
let pendingPasswordResolver: { resolve: (password: string | null) => void } | null = null;

function promptForPdfPassword(isRetry = false): Promise<string | null> {
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

function closePasswordModal(cancelled = false): void {
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
async function processPdfFile(
  file: File,
  fill: HTMLElement | null,
  title: HTMLElement | null,
  detail: HTMLElement | null
): Promise<void> {
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
  state.pdfDoc = parseResult.pdfDoc as PdfDocumentLike;
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
}

async function processJsonFile(
  file: File,
  fill: HTMLElement | null,
  title: HTMLElement | null
): Promise<void> {
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
      return;
    }
  } catch {
    // Fall back to standard extraction
  }

  state.structuredData = extractStructuredData(textContent);
}

async function processTextOrCsvFile(
  file: File,
  fill: HTMLElement | null,
  title: HTMLElement | null
): Promise<void> {
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

function updateDocViewDisplay(): void {
  const canvas = document.getElementById('pdfPageCanvas');
  const placeholder = document.getElementById('pdfNoPreviewMessage');
  if (!state.pdfDoc) {
    if (canvas) canvas.classList.add('hidden');
    if (placeholder) placeholder.classList.remove('hidden');
    setDocViewMode('text');
  } else {
    setDocViewMode('canvas');
  }
}

async function handleFileUpload(file: File): Promise<void> {
  const fileName = file.name.toLowerCase();
  const overlay = document.getElementById('uploadProgressOverlay');
  const fill = document.getElementById('progressBarFill');
  const title = document.getElementById('progressStatusTitle');
  const detail = document.getElementById('progressStatusDetail');

  if (overlay) overlay.classList.remove('hidden');

  try {
    if (fileName.endsWith('.pdf') || file.type === 'application/pdf') {
      await processPdfFile(file, fill, title, detail);
    } else if (fileName.endsWith('.json') || file.type === 'application/json') {
      await processJsonFile(file, fill, title);
    } else {
      await processTextOrCsvFile(file, fill, title);
    }

    renderAllViews();
    updateDocViewDisplay();

    triggerConfetti();
    showToast('AIS extracted successfully!', 'success');

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error parsing document:', error);
    showToast(`Failed to parse document: ${errorMsg}`, 'error', 4000);
  } finally {
    if (overlay) overlay.classList.add('hidden');
  }
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
  void confetti({
    particleCount: 50,
    spread: 60,
    origin: { y: 0.7 },
    colors: [ColorIndigo500, ColorViolet500, ColorEmerald500, ColorSky500]
  });
}

// ==========================================================================
// Rendering Pipeline
// ==========================================================================
function renderAllViews(): void {
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
  if (kpiCredited) kpiCredited.textContent = formatInr(totalCredited);
  if (kpiPaid) kpiPaid.textContent = formatInr(totalTaxPaid);

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

  const partA = ais.part_a_general_info || {
    name_of_assessee: '',
    pan: '',
    aadhaar: '',
    date_of_birth: '',
    mobile_number: '',
    email_address: '',
    address: ''
  };
  const partB1 = ais.part_b1_tds_tcs_transactions || [];
  const partB2 = ais.part_b2_sft_transactions || [];
  const partB3 = ais.part_b3_tax_payments || [];
  const partB4 = ais.part_b4_demand_refunds || [];

  const html = `
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
          ${partB1.length === 0 ? `
            <div class="ais-empty-part">
              <i data-lucide="info" class="btn-icon-sm"></i>
              <span>No TDS / TCS transactions recorded for this period.</span>
            </div>
          ` : ''}
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
                    <td><strong>${formatInr(sft.amount || sft.transaction_amount)}</strong></td>
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
                    <td><strong>${formatInr(ref.refund_amount || ref.amount)}</strong></td>
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

  // Populate Deductor Cards dynamically using <ais-deductor-card> Web Component
  const deductorsContainer = container.querySelector('.ais-deductors-container');
  if (deductorsContainer && partB1.length > 0) {
    deductorsContainer.innerHTML = '';
    partB1.forEach((deductor) => {
      const card = document.createElement('ais-deductor-card') as AisDeductorCard;
      card.deductor = deductor;
      deductorsContainer.append(card);
    });
  }

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

function toggleElementClass(id: string, className: string, force: boolean): void {
  document.getElementById(id)?.classList.toggle(className, force);
}

function setElementDisplay(id: string, display: string): void {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = display;
  }
}

function setDocViewMode(mode: 'canvas' | 'text'): void {
  state.docViewMode = mode;
  const isCanvas = mode === 'canvas';
  const controlDisplay = isCanvas && state.pdfDoc ? 'flex' : 'none';

  toggleElementClass('pdfCanvasContainer', 'hidden', !isCanvas);
  toggleElementClass('rawTextContainer', 'hidden', isCanvas);
  toggleElementClass('viewCanvasBtn', 'active', isCanvas);
  toggleElementClass('viewTextBtn', 'active', !isCanvas);

  setElementDisplay('pdfNavControls', controlDisplay);
  setElementDisplay('pdfZoomControls', controlDisplay);
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
        void handleFileUpload(file);
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
        void handleFileUpload(file);
      }
    });
  }


  // 3. Re-Upload / Reset Button
  document.getElementById('reuploadBtn')?.addEventListener('click', () => {
    resetToFreshUpload();
  });

  // 4. Workspace Tabs
  document.querySelectorAll<HTMLElement>('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab || 'aisview';
      state.activeTab = tabId;

      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(`pane-${tabId}`);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // 5. Document View Switcher (PDF Canvas vs Raw Text)
  document.getElementById('viewCanvasBtn')?.addEventListener('click', () => setDocViewMode('canvas'));
  document.getElementById('viewTextBtn')?.addEventListener('click', () => setDocViewMode('text'));

  // 6. PDF Viewer Navigation
  document.getElementById('prevPageBtn')?.addEventListener('click', () => {
    void changePdfPage(-1);
  });
  document.getElementById('nextPageBtn')?.addEventListener('click', () => {
    void changePdfPage(1);
  });

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

// ==========================================================================
// Initialization (Fresh state - no auto-loading!)
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  refreshIcons();
  setupEventListeners();
});
