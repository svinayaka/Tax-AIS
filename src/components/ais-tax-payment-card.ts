import { PartB3TaxPayment } from '../types/ais';

/**
 * <ais-tax-payment-card> Web Component
 * Renders AIS Part B3 Tax Payments (Challans)
 * Styled using @svinayaka/siddi-design-system design tokens
 */
export class AisTaxPaymentCard extends HTMLElement {
  private _payments: PartB3TaxPayment[] = [];

  constructor() {
    super();
  }

  set payments(val: PartB3TaxPayment[] | null) {
    this._payments = val || [];
    this.render();
  }

  get payments(): PartB3TaxPayment[] {
    return this._payments;
  }

  connectedCallback(): void {
    this.render();
  }

  render(): void {
    const list = this._payments || [];

    this.className = 'ais-part-section';
    this.innerHTML = `
      <div class="ais-part-header">
        <div class="ais-part-title-wrap">
          <i data-lucide="credit-card" class="ais-part-icon" style="color:var(--ksv-ds-color-emerald-500);"></i>
          <h3 class="ais-part-title">Part B3 — Details of Tax Payments (Challans)</h3>
        </div>
        <span class="meta-pill">${list.length} Challan(s)</span>
      </div>

      ${list.length > 0 ? `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>FY</th>
                <th>Major Head</th>
                <th>Minor Head</th>
                <th>Tax Amount</th>
                <th>Total Challan</th>
                <th>BSR Code</th>
                <th>Date of Deposit</th>
                <th>Challan Serial #</th>
              </tr>
            </thead>
            <tbody>
              ${list.map(ch => `
                <tr>
                  <td><span class="meta-pill font-mono">${escapeHtml(ch.financial_year)}</span></td>
                  <td>${escapeHtml(ch.major_head)}</td>
                  <td><span class="meta-pill" style="font-size:var(--ksv-ds-text-2xs);">${escapeHtml(ch.minor_head)}</span></td>
                  <td style="color:var(--ksv-ds-status-success-icon); font-weight:var(--ksv-ds-font-weight-bold);">
                    ₹${Number(ch.tax_amount).toLocaleString('en-IN')}
                  </td>
                  <td><strong>₹${Number(ch.total_challan_amount || ch.tax_amount).toLocaleString('en-IN')}</strong></td>
                  <td class="font-mono">${escapeHtml(ch.bsr_code)}</td>
                  <td>${escapeHtml(ch.date_of_deposit)}</td>
                  <td class="font-mono">${escapeHtml(String(ch.challan_serial_number))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : `
        <div class="ais-empty-part">
          <i data-lucide="info" class="btn-icon-sm"></i>
          <span>No Tax Payment challans recorded for this period.</span>
        </div>
      `}
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

if (!customElements.get('ais-tax-payment-card')) {
  customElements.define('ais-tax-payment-card', AisTaxPaymentCard);
}
