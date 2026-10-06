import type { PartAGeneralInfo } from '../types/ais';
import { escapeHtml } from '../lib/dom-utils';

/**
 * <ais-part-a> Web Component
 * Renders Annual Information Statement (AIS) Part A - General Information
 * Styled using @svinayaka/siddi-design-system design tokens
 */
export class AisPartA extends HTMLElement {
  private _data: PartAGeneralInfo | null = null;

  static get observedAttributes(): string[] {
    return ['tax-year'];
  }

  set data(val: PartAGeneralInfo | null) {
    this._data = val;
    this.render();
  }

  get data(): PartAGeneralInfo | null {
    return this._data;
  }

  connectedCallback(): void {
    this.render();
  }

  attributeChangedCallback(_name: string, oldValue: string, newValue: string): void {
    if (oldValue !== newValue) {
      this.render();
    }
  }

  render(): void {
    const d = this._data;
    const taxYear = this.getAttribute('tax-year') || '2026-27';

    this.className = 'ais-part-section';
    this.innerHTML = `
      <div class="ais-part-header">
        <div class="ais-part-title-wrap">
          <i data-lucide="user-check" class="ais-part-icon" style="color:var(--ksv-ds-text-brand);"></i>
          <h3 class="ais-part-title" style="color:var(--ksv-ds-text-brand); font-size:var(--ksv-ds-text-lg); font-weight:var(--ksv-ds-font-weight-bold);">
            Part A - General Information
          </h3>
        </div>
        <span class="meta-pill">Tax Year (T.Y.): ${escapeHtml(taxYear)}</span>
      </div>

      <div class="ais-grid-general">
        <!-- Row 1: PAN & Aadhaar (Side-by-side on mobile) -->
        <div class="ais-gen-card ais-gen-col-1 ais-gen-divider-bottom">
          <span class="ais-gen-label">Permanent Account Number (PAN)</span>
          <div class="ais-gen-value font-mono">
            ${escapeHtml(d?.pan || '—')}
          </div>
        </div>

        <div class="ais-gen-card ais-gen-col-1 ais-gen-divider-bottom">
          <span class="ais-gen-label">Aadhaar Number</span>
          <div class="ais-gen-value font-mono">
            ${escapeHtml(d?.aadhaar || '—')}
          </div>
        </div>

        <!-- Row 2: Name of Assessee -->
        <div class="ais-gen-card ais-gen-col-2 ais-gen-divider-bottom">
          <span class="ais-gen-label">Name of Assessee</span>
          <div class="ais-gen-value">
            ${escapeHtml(d?.name_of_assessee || '—')}
          </div>
        </div>

        <!-- Row 3: DOB & Mobile (Side-by-side on mobile) -->
        <div class="ais-gen-card ais-gen-col-1 ais-gen-divider-bottom">
          <span class="ais-gen-label">Date of Birth</span>
          <div class="ais-gen-value">
            ${escapeHtml(d?.date_of_birth || '—')}
          </div>
        </div>

        <div class="ais-gen-card ais-gen-col-1 ais-gen-divider-bottom">
          <span class="ais-gen-label">Mobile Number</span>
          <div class="ais-gen-value font-mono">
            ${escapeHtml(d?.mobile_number || '—')}
          </div>
        </div>

        <!-- Row 4: E-mail Address -->
        <div class="ais-gen-card ais-gen-col-2 ais-gen-divider-bottom">
          <span class="ais-gen-label">E-mail Address</span>
          <div class="ais-gen-value font-mono" style="font-size:var(--ksv-ds-text-sm);">
            ${escapeHtml(d?.email_address || '—')}
          </div>
        </div>

        <!-- Row 5: Address (Full Width) -->
        <div class="ais-gen-card ais-gen-col-2 ais-gen-card--address">
          <span class="ais-gen-label">Address</span>
          <div class="ais-gen-value" style="font-weight:var(--ksv-ds-font-weight-semibold); line-height:var(--ksv-ds-leading-relaxed);">
            ${escapeHtml(d?.address || '—')}
          </div>
        </div>
      </div>
    `;
  }
}

if (!customElements.get('ais-part-a')) {
  customElements.define('ais-part-a', AisPartA);
}
