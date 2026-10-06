import { createIcons, icons } from 'lucide';
import type { ItrClassificationResult } from '../types/ais';
import { escapeHtml, formatInr } from '../lib/dom-utils';

/**
 * <ais-itr-advisor> Web Component
 * Renders intelligent tax filing form recommendations (ITR-1 Sahaj vs ITR-2 / ITR-3)
 * with CBDT statutory disqualifiers and interactive external criteria checklists.
 * Styled with @svinayaka/siddi-design-system design tokens.
 */
export class AisItrAdvisor extends HTMLElement {
  private _data: ItrClassificationResult | null = null;
  private _checkedIds = new Set<string>();

  set data(val: ItrClassificationResult | null) {
    this._data = val;
    this._checkedIds.clear();
    this.render();
  }

  get data(): ItrClassificationResult | null {
    return this._data;
  }

  connectedCallback(): void {
    this.style.display = 'block';
    this.render();
  }

  private toggleChecklistItem(id: string, isChecked: boolean): void {
    if (isChecked) {
      this._checkedIds.add(id);
    } else {
      this._checkedIds.delete(id);
    }
    this.updateChecklistCallout();
  }

  private updateChecklistCallout(): void {
    const callout = this.querySelector('#itrChecklistCallout') as HTMLElement | null;
    const badge = this.querySelector('#itrDynamicBadge') as HTMLElement | null;
    if (!callout || !badge) return;

    const checkedCount = this._checkedIds.size;
    const isBaseItr1 = this._data?.recommendedForm === 'ITR-1';
    const isElevated = checkedCount > 0 && isBaseItr1;

    if (isElevated) {
      callout.classList.remove('hidden');
      badge.textContent = 'ITR-2 (Elevated by Checklist)';
      badge.className = 'ais-itr-badge ais-itr-badge--warning';
    } else {
      callout.classList.add('hidden');
      badge.textContent = this._data?.recommendedForm || 'ITR-1';
      badge.className = `ais-itr-badge ais-itr-badge--${this.getBadgeVariant()}`;
    }

    this.dispatchEvent(new CustomEvent('itr-form-changed', {
      bubbles: true,
      detail: {
        effectiveForm: isElevated ? 'ITR-2' : (this._data?.recommendedForm || 'ITR-1'),
        isEligibleForItr1: !isElevated && isBaseItr1
      }
    }));
  }

  private getBadgeVariant(): string {
    const form = this._data?.recommendedForm;
    if (form === 'ITR-1') return 'success';
    if (form === 'ITR-2') return 'info';
    return 'warning';
  }

  render(): void {
    if (!this._data) {
      this.innerHTML = '';
      this.style.display = 'none';
      return;
    }

    const d = this._data;
    const variant = this.getBadgeVariant();
    const disqualifiers = d.disqualifiersFromItr1 || [];
    const eligibleFactors = d.eligibleFactors || [];
    const checklist = d.checklist || [];

    this.style.display = 'block';
    this.className = 'ais-part-section ais-itr-advisor-section';
    this.innerHTML = `
      <div class="ais-part-header">
        <div class="ais-itr-header-badges">
          <span id="itrDynamicBadge" class="ais-itr-badge ais-itr-badge--${variant}">
            ${escapeHtml(d.targetWorkspace || d.recommendedForm)}
          </span>
          ${d.calculatedTotalIncome > 0 ? `
            <span class="meta-pill">
              Parsed Income: ${formatInr(d.calculatedTotalIncome)}
            </span>
          ` : ''}
          <span class="meta-pill">
            ${escapeHtml(d.confidence === 'high' ? 'Verified from AIS' : 'Provisional')}
          </span>
        </div>
      </div>

      <div class="ais-itr-headline-card ais-itr-headline--${variant}">
        <div class="ais-itr-headline-title">${escapeHtml(d.headline)}</div>
        <p class="ais-itr-headline-desc">${escapeHtml(d.summaryReason)}</p>
      </div>

      ${disqualifiers.length > 0 ? `
        <div class="ais-itr-disqualifiers-box">
          <div class="ais-itr-box-title">
            <i data-lucide="alert-triangle" class="ais-itr-box-icon" style="color:var(--ksv-ds-status-warning-icon);"></i>
            <span>Statutory Disqualifiers from Form ITR-1 (Sahaj)</span>
          </div>
          <ul class="ais-itr-list">
            ${disqualifiers.map(item => `
              <li class="ais-itr-list-item ais-itr-list-item--disqualifier">
                <i data-lucide="x-circle" class="ais-itr-item-icon"></i>
                <span>${escapeHtml(item)}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      ` : ''}

      ${eligibleFactors.length > 0 ? `
        <div class="ais-itr-factors-box">
          <div class="ais-itr-box-title">
            <i data-lucide="check-circle-2" class="ais-itr-box-icon" style="color:var(--ksv-ds-status-success-icon);"></i>
            <span>Verified Allowable Income Streams in AIS</span>
          </div>
          <ul class="ais-itr-list">
            ${eligibleFactors.map(f => `
              <li class="ais-itr-list-item ais-itr-list-item--eligible">
                <i data-lucide="check" class="ais-itr-item-icon"></i>
                <span>${escapeHtml(f)}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      ` : ''}

      <!-- Interactive Verification Checklist (Exclusively rendered when provisionally ITR-1) -->
      ${d.recommendedForm === 'ITR-1' && checklist.length > 0 ? `
        <div class="ais-itr-checklist-box">
          <div class="ais-itr-box-title">
            <i data-lucide="list-checks" class="ais-itr-box-icon" style="color:var(--ksv-ds-text-brand);"></i>
            <span>External Statutory Checklist (Parameters Outside AIS)</span>
          </div>
          <p class="ais-itr-checklist-desc">
            AIS contains transactions reported by banks and deductors. Check any condition below that applies to your filing year:
          </p>

          <div id="itrChecklistCallout" class="ais-itr-elevation-callout hidden">
            <i data-lucide="alert-circle" class="ais-itr-box-icon" style="color:var(--ksv-ds-status-warning-icon);"></i>
            <span>
              <strong>ITR-2 Required:</strong> One or more checked criteria exceed ITR-1 statutory limits. You must file Form ITR-2 (or ITR-3).
            </span>
          </div>

          <div class="ais-itr-checklist-items">
            ${checklist.map(item => `
              <label class="ais-itr-checklist-row" for="chk_${escapeHtml(item.id)}">
                <input
                  type="checkbox"
                  id="chk_${escapeHtml(item.id)}"
                  data-checklist-id="${escapeHtml(item.id)}"
                  class="ais-itr-checkbox"
                />
                <div class="ais-itr-checklist-content">
                  <div class="ais-itr-question">${escapeHtml(item.question)}</div>
                  <div class="ais-itr-impact">${escapeHtml(item.impactIfYes)}</div>
                </div>
              </label>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;

    // Bind checkbox event listeners
    const checkboxes = this.querySelectorAll<HTMLInputElement>('.ais-itr-checkbox');
    checkboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        const id = cb.dataset.checklistId || '';
        this.toggleChecklistItem(id, cb.checked);
      });
    });

    createIcons({ icons, root: this });
  }
}

if (!customElements.get('ais-itr-advisor')) {
  customElements.define('ais-itr-advisor', AisItrAdvisor);
}
