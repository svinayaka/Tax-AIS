import { createIcons, icons } from 'lucide';
import confetti from 'canvas-confetti';

import { parsePdfDocument, renderPageToCanvas } from './lib/pdf-parser.js';
import { extractStructuredData } from './lib/extractor.js';
import { SAMPLE_DOCUMENTS } from './lib/sample-data.js';
import { exportToJson, exportToCsv, exportToMarkdown, downloadFile } from './lib/exporter.js';

// ==========================================================================
// Application State
// ==========================================================================
const state = {
  theme: localStorage.getItem('documorph_theme') || 'dark',
  currentFile: null,
  rawText: '',
  pdfDoc: null,
  currentPageNum: 1,
  totalPages: 1,
  currentZoom: 1.0,
  structuredData: null,
  activeTab: 'aisview',
};

// Initialize Icons Helper
function refreshIcons() {
  createIcons({ icons });
}

// ==========================================================================
// Toast Notification Engine
// ==========================================================================
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const iconName = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'shield-check';
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
function initTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  document.documentElement.setAttribute('data-ksv-ds-theme', state.theme);
  const toggleBtn = document.getElementById('themeToggleBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', state.theme);
      document.documentElement.setAttribute('data-ksv-ds-theme', state.theme);
      localStorage.setItem('documorph_theme', state.theme);
      showToast(`Switched to ${state.theme} theme`, 'info', 2000);
    });
  }
}

// ==========================================================================
// PDF Password Handling
// ==========================================================================
let pendingPasswordResolver = null;

function promptForPdfPassword(isRetry = false) {
  return new Promise((resolve) => {
    const backdrop = document.getElementById('passwordModalBackdrop');
    const input = document.getElementById('aisPasswordInput');
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

function closePasswordModal(cancelled = false) {
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
// PDF Parsing & Extraction Orchestrator
// ==========================================================================
async function handlePdfUpload(file) {
  const overlay = document.getElementById('uploadProgressOverlay');
  const fill = document.getElementById('progressBarFill');
  const title = document.getElementById('progressStatusTitle');
  const detail = document.getElementById('progressStatusDetail');

  overlay.classList.remove('hidden');

  try {
    const parseResult = await parsePdfDocument(
      file,
      ({ stage, percent, message }) => {
        fill.style.width = `${percent}%`;
        detail.textContent = message;
        if (stage === 'loading') title.textContent = 'Reading AIS PDF Binary...';
        if (stage === 'parsing') title.textContent = 'Extracting Layout Stream...';
        if (stage === 'extracting') title.textContent = 'Parsing Part A & Part B...';
        if (stage === 'finishing') title.textContent = 'Sanitizing PII & Building JSON...';
      },
      null,
      promptForPdfPassword
    );

    state.currentFile = file;
    state.rawText = parseResult.rawText;
    state.pdfDoc = parseResult.pdfDoc;
    state.totalPages = parseResult.pageCount || 1;
    state.currentPageNum = 1;

    // Run AIS Extraction Pipeline
    const structured = extractStructuredData(parseResult.rawText);
    state.structuredData = structured;

    // Render results
    renderAllViews(file.name);

    // Render PDF first page in canvas
    if (state.pdfDoc) {
      const page = await state.pdfDoc.getPage(1);
      const canvas = document.getElementById('pdfPageCanvas');
      document.getElementById('pdfNoPreviewMessage').classList.add('hidden');
      canvas.classList.remove('hidden');
      await renderPageToCanvas(page, canvas, state.currentZoom * 1.3);
      updatePdfNavControls();
    }

    // Success celebration
    triggerConfetti();
    showToast('AIS Part A & Part B extracted successfully with PII scrubbing!', 'success');

  } catch (error) {
    console.error('Error parsing AIS PDF:', error);
    showToast(`Failed to parse AIS PDF: ${error.message || 'Unknown error'}`, 'error', 4000);
  } finally {
    overlay.classList.add('hidden');
  }
}

async function loadReferenceAisPdf() {
  try {
    const response = await fetch('/src/assets/XXXPV2797X_2026-27_AIS_unlocked.pdf');
    if (!response.ok) {
      // Fallback to sample text if direct asset fetch is restricted
      handleLoadSample('ais');
      return;
    }
    const blob = await response.blob();
    const file = new File([blob], 'XXXPV2797X_2026-27_AIS_unlocked.pdf', { type: 'application/pdf' });
    await handlePdfUpload(file);
  } catch (err) {
    console.warn('Loading fallback sample text:', err);
    handleLoadSample('ais');
  }
}

function handleLoadSample(sampleId) {
  const sample = SAMPLE_DOCUMENTS.find(s => s.id === sampleId) || SAMPLE_DOCUMENTS[0];
  if (!sample) return;

  const overlay = document.getElementById('uploadProgressOverlay');
  const fill = document.getElementById('progressBarFill');
  const title = document.getElementById('progressStatusTitle');
  const detail = document.getElementById('progressStatusDetail');

  overlay.classList.remove('hidden');
  fill.style.width = '30%';
  title.textContent = 'Loading Reference AIS...';
  detail.textContent = 'Extracting Part A & Part B...';

  setTimeout(() => {
    fill.style.width = '100%';

    state.currentFile = { name: 'XXXPV2797X_2026-27_AIS_unlocked.pdf' };
    state.rawText = sample.rawText;
    state.pdfDoc = null;
    state.totalPages = 1;
    state.currentPageNum = 1;

    // Extract Structured Data
    state.structuredData = extractStructuredData(sample.rawText);

    // Hide PDF canvas, show notice if no PDF doc
    const canvas = document.getElementById('pdfPageCanvas');
    const placeholder = document.getElementById('pdfNoPreviewMessage');
    if (canvas && placeholder) {
      canvas.classList.add('hidden');
      placeholder.classList.remove('hidden');
    }

    renderAllViews('Annual Information Statement (AIS - Form 168)');
    overlay.classList.add('hidden');

    triggerConfetti();
    showToast('Loaded Reference AIS (Tax Year 2026-27)!', 'success');
  }, 250);
}

function triggerConfetti() {
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
function renderAllViews(fileName) {
  const data = state.structuredData;
  if (!data) return;

  const ais = data.aisJson || {};
  const partA = ais.part_a_general_info || {};
  const partB1 = ais.part_b1_tds_tcs_transactions || [];
  const partB3 = ais.part_b3_tax_payments || [];

  // Reveal Workspace
  const workspace = document.getElementById('resultsWorkspace');
  workspace.classList.remove('hidden');
  workspace.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // 1. Header Banner
  document.getElementById('docTitleHeading').textContent = `Annual Information Statement (AIS - Form 168)`;
  document.getElementById('taxYearBannerBadge').textContent = `Tax Year: ${ais.tax_year || '2026-27'}`;
  document.getElementById('docSummaryText').textContent = `Assessee: ${partA.name_of_assessee} (PAN: ${partA.pan}), ${partB1.length} TDS Deductor source(s), ${partB3.length} Tax Payment challan(s) extracted.`;

  // 2. Render KPI Cards
  const totalCredited = partB1.reduce((sum, d) => sum + (d.total_amount_credited || d.total_amount || 0), 0);
  const totalTaxPaid = partB3.reduce((sum, ch) => sum + (ch.tax_amount || 0), 0);

  document.getElementById('kpiTdsCount').textContent = partB1.length;
  document.getElementById('kpiTotalCredited').textContent = `₹${totalCredited.toLocaleString('en-IN')}`;
  document.getElementById('kpiTaxPaid').textContent = `₹${totalTaxPaid.toLocaleString('en-IN')}`;

  // 3. Render AIS Dashboard (Part A & Part B)
  renderAisDashboard(ais);

  // 4. Render JSON Schema Tab
  document.getElementById('fullJsonDisplay').textContent = exportToJson(data, true);

  refreshIcons();
}

/**
 * Render Ultra-Elegant AIS Tax Intelligence Dashboard
 */
function renderAisDashboard(ais) {
    const container = document.getElementById('aisDashboardContainer');
    if (!container) return;

    const partA = ais.part_a_general_info || {};
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

      <!-- PART A: General Information -->
      <div class="ais-part-section">
        <div class="ais-part-header">
          <div class="ais-part-title-wrap">
            <i data-lucide="user-check" class="ais-part-icon"></i>
            <h3 class="ais-part-title" style="color:var(--ksv-ds-text-brand); font-size:1.15rem; font-weight:700;">Part A - General Information</h3>
          </div>
          <span class="meta-pill">Tax Year (T.Y.): ${escapeHtml(ais.tax_year || '2026-27')}</span>
        </div>

        <div class="ais-grid-general">
          <!-- Row 1: PAN, Aadhaar, Name -->
          <div class="ais-gen-card">
            <span class="ais-gen-label">Permanent Account Number (PAN)</span>
            <div class="ais-gen-value font-mono">
              ${escapeHtml(partA.pan || '—')}
            </div>
          </div>

          <div class="ais-gen-card">
            <span class="ais-gen-label">Aadhaar Number</span>
            <div class="ais-gen-value font-mono">
              ${escapeHtml(partA.aadhaar || '—')}
            </div>
          </div>

          <div class="ais-gen-card">
            <span class="ais-gen-label">Name of Assessee</span>
            <div class="ais-gen-value">
              ${escapeHtml(partA.name_of_assessee || '—')}
            </div>
          </div>

          <!-- Row 2: DOB, Mobile, Email -->
          <div class="ais-gen-card">
            <span class="ais-gen-label">Date of Birth</span>
            <div class="ais-gen-value">
              ${escapeHtml(partA.date_of_birth || '—')}
            </div>
          </div>

          <div class="ais-gen-card">
            <span class="ais-gen-label">Mobile Number</span>
            <div class="ais-gen-value font-mono">
              ${escapeHtml(partA.mobile_number || '—')}
            </div>
          </div>

          <div class="ais-gen-card">
            <span class="ais-gen-label">E-mail Address</span>
            <div class="ais-gen-value font-mono" style="font-size:0.875rem;">
              ${escapeHtml(partA.email_address || '—')}
            </div>
          </div>

          <!-- Row 3: Address (Full Width) -->
          <div class="ais-gen-card" style="grid-column: 1 / -1;">
            <span class="ais-gen-label">Address</span>
            <div class="ais-gen-value" style="font-weight:600; line-height:1.5;">
              ${escapeHtml(partA.address || '—')}
            </div>
          </div>
        </div>
      </div>

      <!-- PART B1: TDS / TCS Transactions -->
      <div class="ais-part-section">
        <div class="ais-part-header">
          <div class="ais-part-title-wrap">
            <i data-lucide="receipt" class="ais-part-icon" style="color:var(--color-blue);"></i>
            <h3 class="ais-part-title">Part B1 — Tax Deducted or Collected at Source (TDS / TCS)</h3>
          </div>
          <span class="meta-pill">${partB1.length} Deductor Sources</span>
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
                        <td style="color:var(--ksv-ds-status-warning-icon);">₹${Number(item.tds_deducted).toLocaleString('en-IN')}</td>
                        <td style="color:var(--ksv-ds-status-success-icon);">₹${Number(item.tds_deposited).toLocaleString('en-IN')}</td>
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

      <!-- PART B3: Payment of Taxes -->
      <div class="ais-part-section">
        <div class="ais-part-header">
          <div class="ais-part-title-wrap">
            <i data-lucide="landmark" class="ais-part-icon" style="color:var(--color-emerald);"></i>
            <h3 class="ais-part-title">Part B3 — Information Relating to Payment of Taxes (Challans)</h3>
          </div>
          <span class="meta-pill">${partB3.length} Challan(s)</span>
        </div>

        ${partB3.length > 0 ? `
          <div class="ais-challan-grid">
            ${partB3.map((ch) => `
              <div class="ais-challan-card">
                <div class="ais-challan-row">
                  <div>
                    <span class="ais-gen-label">Financial Year</span>
                    <div class="ais-gen-value">${escapeHtml(ch.financial_year)}</div>
                  </div>
                  <div>
                    <span class="ais-gen-label">Major Head</span>
                    <div class="ais-gen-value">${escapeHtml(ch.major_head)}</div>
                  </div>
                  <div>
                    <span class="ais-gen-label">Minor Head</span>
                    <div class="ais-gen-value"><span class="meta-pill">${escapeHtml(ch.minor_head)}</span></div>
                  </div>
                  <div>
                    <span class="ais-gen-label">Tax Paid</span>
                    <div class="ais-gen-value" style="color:var(--ksv-ds-status-success-icon); font-size:1.1rem; font-weight:800;">
                      ₹${Number(ch.tax_amount).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                <div class="ais-challan-row" style="padding-top: var(--ksv-ds-space-3); border-top: 1px dashed var(--ksv-ds-border-subtle);">
                  <div>
                    <span class="ais-gen-label">BSR Code</span>
                    <div class="ais-gen-value"><code>${escapeHtml(ch.bsr_code)}</code></div>
                  </div>
                  <div>
                    <span class="ais-gen-label">Date of Deposit</span>
                    <div class="ais-gen-value">${escapeHtml(ch.date_of_deposit)}</div>
                  </div>
                  <div>
                    <span class="ais-gen-label">Challan Serial No</span>
                    <div class="ais-gen-value"><code>${escapeHtml(String(ch.challan_serial_number))}</code></div>
                  </div>
                  <div>
                    <span class="ais-gen-label">Challan Total</span>
                    <div class="ais-gen-value"><strong>₹${Number(ch.total_challan_amount).toLocaleString('en-IN')}</strong></div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="ais-empty-part">
            <i data-lucide="info" class="btn-icon-sm"></i>
            <span>No Tax Payments or Challans recorded for this period.</span>
          </div>
        `}
      </div>

      <!-- PART B4: Demand and Refund -->
      <div class="ais-part-section">
        <div class="ais-part-header">
          <div class="ais-part-title-wrap">
            <i data-lucide="badge-dollar-sign" class="ais-part-icon" style="color:var(--color-amber);"></i>
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
                    <td>${escapeHtml(ref.financial_year || ref.assessment_year)}</td>
                    <td>${escapeHtml(ref.nature_of_refund || ref.nature)}</td>
                    <td><strong>₹${Number(ref.refund_amount || ref.amount).toLocaleString('en-IN')}</strong></td>
                    <td>${escapeHtml(ref.date_of_payment || ref.date_of_issuance)}</td>
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
  refreshIcons();
}

// --------------------------------------------------------------------------
// PDF Canvas Page Navigation
// --------------------------------------------------------------------------
async function changePdfPage(delta) {
  if (!state.pdfDoc) return;
  const newPage = state.currentPageNum + delta;
  if (newPage < 1 || newPage > state.totalPages) return;

  state.currentPageNum = newPage;
  const page = await state.pdfDoc.getPage(newPage);
  const canvas = document.getElementById('pdfPageCanvas');
  await renderPageToCanvas(page, canvas, state.currentZoom * 1.3);
  updatePdfNavControls();
}

function updatePdfNavControls() {
  const indicator = document.getElementById('pdfPageIndicator');
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');

  if (indicator) indicator.textContent = `Page ${state.currentPageNum} of ${state.totalPages}`;
  if (prevBtn) prevBtn.disabled = state.currentPageNum <= 1;
  if (nextBtn) nextBtn.disabled = state.currentPageNum >= state.totalPages;
}

// ==========================================================================
// Event Listeners Setup
// ==========================================================================
function setupEventListeners() {
  // 1. File Dropzone
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
          showToast('Please select a valid AIS PDF file.', 'error');
          return;
        }
        handlePdfUpload(file);
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
      const file = e.dataTransfer?.files?.[0];
      if (file) {
        if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
          showToast('Please drop a valid AIS PDF file.', 'error');
          return;
        }
        handlePdfUpload(file);
      }
    });
  }

  // 2. Load Reference AIS Button
  document.getElementById('loadReferenceAisBtn')?.addEventListener('click', () => {
    loadReferenceAisPdf();
  });

  // 3. Workspace Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      state.activeTab = tabId;

      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(`pane-${tabId}`);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // 4. Header Action Buttons
  document.getElementById('reuploadBtn')?.addEventListener('click', () => {
    document.getElementById('fileInput').click();
  });

  document.getElementById('copyJsonBtn')?.addEventListener('click', () => {
    if (!state.structuredData) return;
    navigator.clipboard.writeText(exportToJson(state.structuredData, true));
    showToast('Strict JSON Schema copied to clipboard!', 'success');
  });

  document.getElementById('copyJsonTabBtn')?.addEventListener('click', () => {
    if (!state.structuredData) return;
    navigator.clipboard.writeText(exportToJson(state.structuredData, true));
    showToast('Strict JSON Schema copied to clipboard!', 'success');
  });

  document.getElementById('downloadJsonTabBtn')?.addEventListener('click', () => {
    if (!state.structuredData) return;
    downloadFile(exportToJson(state.structuredData, true), `${state.currentFile?.name?.replace(/\.pdf$/i, '') || 'AIS_2026-27'}_structured.json`, 'application/json');
    showToast('Downloaded JSON schema file!', 'success');
  });

  // 5. Export Dropdown Menu
  const exportBtn = document.getElementById('exportDropdownBtn');
  const exportMenu = document.getElementById('exportMenu');
  if (exportBtn && exportMenu) {
    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      exportMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
      exportMenu.classList.add('hidden');
    });

    exportMenu.querySelectorAll('.export-item').forEach(item => {
      item.addEventListener('click', () => {
        const type = item.getAttribute('data-export');
        const filename = state.currentFile?.name?.replace(/\.pdf$/i, '') || 'AIS_2026-27';
        
        if (type === 'json') {
          downloadFile(exportToJson(state.structuredData, true), `${filename}.json`, 'application/json');
          showToast('Exported structured JSON!', 'success');
        } else if (type === 'csv') {
          downloadFile(exportToCsv(state.structuredData), `${filename}.csv`, 'text/csv');
          showToast('Exported structured CSV!', 'success');
        } else if (type === 'markdown') {
          downloadFile(exportToMarkdown(state.structuredData), `${filename}.md`, 'text/markdown');
          showToast('Exported Markdown report!', 'success');
        } else if (type === 'print') {
          window.print();
        }
      });
    });
  }

  // 6. PDF Viewer Controls
  document.getElementById('prevPageBtn')?.addEventListener('click', () => changePdfPage(-1));
  document.getElementById('nextPageBtn')?.addEventListener('click', () => changePdfPage(1));

  document.getElementById('zoomInBtn')?.addEventListener('click', async () => {
    if (state.currentZoom < 2.0 && state.pdfDoc) {
      state.currentZoom += 0.25;
      document.getElementById('zoomLevelText').textContent = `${Math.round(state.currentZoom * 100)}%`;
      const page = await state.pdfDoc.getPage(state.currentPageNum);
      const canvas = document.getElementById('pdfPageCanvas');
      await renderPageToCanvas(page, canvas, state.currentZoom * 1.3);
    }
  });

  document.getElementById('zoomOutBtn')?.addEventListener('click', async () => {
    if (state.currentZoom > 0.5 && state.pdfDoc) {
      state.currentZoom -= 0.25;
      document.getElementById('zoomLevelText').textContent = `${Math.round(state.currentZoom * 100)}%`;
      const page = await state.pdfDoc.getPage(state.currentPageNum);
      const canvas = document.getElementById('pdfPageCanvas');
      await renderPageToCanvas(page, canvas, state.currentZoom * 1.3);
    }
  });

  // 7. Password Modal Controls
  const submitPassword = () => {
    const input = document.getElementById('aisPasswordInput');
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
    const input = document.getElementById('aisPasswordInput');
    if (!input) return;
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
  });
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==========================================================================
// Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  refreshIcons();
  setupEventListeners();

  // Load the reference AIS document on launch
  loadReferenceAisPdf();
});
