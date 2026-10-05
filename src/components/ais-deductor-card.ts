import { PartB1TdsTcsTransaction } from '../types/ais';

/**
 * <ais-deductor-card> Web Component
 * Renders AIS Part B1 Deductor card with nested quarterly line items
 * Styled with @svinayaka/siddi-design-system tokens
 */
export class AisDeductorCard extends HTMLElement {
  private _deductor: PartB1TdsTcsTransaction | null = null;

  constructor() {
    super();
  }

  set deductor(val: PartB1TdsTcsTransaction | null) {
    this._deductor = val;
    this.render();
  }

  get deductor(): PartB1TdsTcsTransaction | null {
    return this._deductor;
  }

  connectedCallback(): void {
    this.render();
  }

  render(): void {
    const d = this._deductor || {} as Partial<PartB1TdsTcsTransaction>;
    const lineItems = d.line_items || [];
    const total = d.total_amount_credited || d.total_amount || 0;

    this.className = 'ais-deductor-block';
    this.innerHTML = `
      <div class="ais-deductor-header">
        <div>
          <div class="ais-deductor-name">${escapeHtml(d.information_source || 'Deductor Entity')}</div>
          <div class="ais-deductor-meta">
            <strong>Code:</strong> ${escapeHtml(d.information_code || 'TDS')} &bull; ${escapeHtml(d.information_description || '')}
          </div>
        </div>
        <div class="ais-deductor-metrics">
          <div class="ais-metric-pill">
            <span class="ais-metric-label">Total Amount Credited</span>
            <span class="ais-metric-val" style="color:var(--ksv-ds-text-brand); font-weight:var(--ksv-ds-font-weight-bold);">
              ₹${Number(total).toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>

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
            ${lineItems.map((item, idx) => `
              <tr>
                <td>${item.sr_no || idx + 1}</td>
                <td><span class="meta-pill" style="font-size:var(--ksv-ds-text-2xs);">${escapeHtml(item.quarter)}</span></td>
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
    `;
  }
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

if (!customElements.get('ais-deductor-card')) {
  customElements.define('ais-deductor-card', AisDeductorCard);
}
