import type { PartB1TdsTcsTransaction } from '../types/ais';
import { escapeHtml, formatInr } from '../lib/dom-utils';
import { createIcons, icons } from 'lucide';

/**
 * <ais-deductor-card> Web Component
 * Renders AIS Part B1 Deductor card with nested quarterly line items
 * Styled with @svinayaka/siddi-design-system tokens
 */
export class AisDeductorCard extends HTMLElement {
  private _deductor: PartB1TdsTcsTransaction | null = null;

  set deductor(val: PartB1TdsTcsTransaction | null) {
    this._deductor = val;
    this.render();
  }

  get deductor(): PartB1TdsTcsTransaction | null {
    return this._deductor;
  }

  connectedCallback(): void {
    this.style.display = 'block';
    this.render();
  }

  render(): void {
    const d = this._deductor;
    const lineItems = d?.line_items ?? [];
    const total = d?.total_amount_credited ?? d?.total_amount ?? 0;

    const activeItems = lineItems.filter(item => (item.status || '').toLowerCase() !== 'inactive');
    const inactiveItems = lineItems.filter(item => (item.status || '').toLowerCase() === 'inactive');

    const activeTds = activeItems.reduce((sum, item) => sum + (item.tds_deducted || 0), 0);
    const inactiveTds = inactiveItems.reduce((sum, item) => sum + (item.tds_deducted || 0), 0);

    this.style.display = 'block';
    this.className = 'ais-deductor-block';
    this.innerHTML = `
      <div class="ais-deductor-header">
        <div>
          <div class="ais-deductor-name">${escapeHtml(d?.information_source || 'Unknown Deductor')}</div>
          <div class="ais-deductor-meta">
            <strong>Code:</strong> ${escapeHtml(d?.information_code || '—')} &bull; ${escapeHtml(d?.information_description || '')}
          </div>
        </div>
        <div class="ais-deductor-metrics">
          <div class="ais-metric-pill" title="Total gross amount credited across active transactions">
            <span class="ais-metric-label">Total Amount Credited</span>
            <span class="ais-metric-val" style="color:var(--ksv-ds-text-brand); font-weight:var(--ksv-ds-font-weight-bold);">
              ${formatInr(total)}
            </span>
          </div>
          <div class="ais-metric-pill" title="Eligible TDS deducted from active transactions valid for tax credit in your return">
            <span class="ais-metric-label">TDS Deducted</span>
            <span class="ais-metric-val" style="color:var(--ksv-ds-status-warning-icon); font-weight:var(--ksv-ds-font-weight-bold);">
              ${formatInr(activeTds)}
            </span>
          </div>
          ${inactiveItems.length > 0 ? `
            <div class="ais-metric-pill ais-metric-pill--superseded ais-tooltip-wrapper" tabindex="0">
              <span class="ais-metric-label">
                Superseded / Inactive
                <i data-lucide="info" class="btn-icon-xs" style="color:var(--ksv-ds-text-tertiary);"></i>
              </span>
              <span class="ais-metric-val" style="color:var(--ksv-ds-text-tertiary); font-weight:var(--ksv-ds-font-weight-bold);">
                ${formatInr(inactiveTds)} <small style="font-size:var(--ksv-ds-text-2xs); font-weight:var(--ksv-ds-font-weight-normal);">(${inactiveItems.length})</small>
              </span>
              <div class="ais-tooltip-bubble" role="tooltip">
                <strong>Superseded / Corrected Records</strong>
                <span>Under CBDT rules, inactive rows represent transactions superseded or corrected by revised deductor filings. They are excluded from income and tax credit computations to prevent duplicate claims.</span>
              </div>
            </div>
          ` : ''}
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
                <td>${item.sr_no ?? (idx + 1)}</td>
                <td><span class="meta-pill" style="font-size:var(--ksv-ds-text-2xs);">${escapeHtml(item.quarter)}</span></td>
                <td>${escapeHtml(item.date_of_payment)}</td>
                <td><strong>${formatInr(item.amount_paid_credited)}</strong></td>
                <td style="color:var(--ksv-ds-status-warning-icon);">${formatInr(item.tds_deducted)}</td>
                <td style="color:var(--ksv-ds-status-success-icon);">${formatInr(item.tds_deposited)}</td>
                <td>
                  <span class="${item.status?.toLowerCase() === 'inactive' ? 'status-pill-inactive' : 'status-pill-active'}">
                    <i data-lucide="${item.status?.toLowerCase() === 'inactive' ? 'circle-dashed' : 'check-circle-2'}" class="btn-icon-xs"></i>
                    ${escapeHtml(item.status || 'Active')}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    createIcons({
      icons,
      nameAttr: 'data-lucide',
      root: this,
    });
  }
}

if (!customElements.get('ais-deductor-card')) {
  customElements.define('ais-deductor-card', AisDeductorCard);
}
