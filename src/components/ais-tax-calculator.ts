/**
 * <ais-tax-calculator> Web Component
 * Interactive Dual-Regime (New vs Old) Tax Calculator & Optimizer for AY 2026-27
 * Exclusively active for ITR-1 (Sahaj) taxpayers on the main results page.
 */

import { createIcons, icons } from 'lucide';
import type { AisDeveloperSchema } from '../types/ais';
import { escapeHtml, formatInr } from '../lib/dom-utils';
import {
  calculateTaxComparison,
  DEFAULT_DEDUCTIONS,
  type TaxDeductionInputs,
  type DualRegimeTaxComparison,
  type RegimeTaxBreakdown
} from '../lib/tax-calculator';

export class AisTaxCalculator extends HTMLElement {
  private _aisData: AisDeveloperSchema | null = null;
  private _isEligibleForItr1 = true;
  private _selectedRegime: 'NEW' | 'OLD' | null = null;
  private _deductions: TaxDeductionInputs = { ...DEFAULT_DEDUCTIONS };
  private _showDeductionEditor = false;

  set data(val: AisDeveloperSchema | null) {
    this._aisData = val;
    this._selectedRegime = null; // reset to auto-recommendation
    this.render();
  }

  get data(): AisDeveloperSchema | null {
    return this._aisData;
  }

  set isEligibleForItr1(val: boolean) {
    this._isEligibleForItr1 = val;
    this.render();
  }

  get isEligibleForItr1(): boolean {
    return this._isEligibleForItr1;
  }

  connectedCallback(): void {
    this.style.display = 'block';
    this.render();
  }

  private handleRegimeSelect(regime: 'NEW' | 'OLD'): void {
    this._selectedRegime = regime;
    if (regime === 'NEW') {
      // Under Section 115BAC (New Tax Regime), Chapter VI-A deductions are legally disallowed.
      // Automatically collapse/hide the deduction editor and nullify previous values back to zero.
      this._showDeductionEditor = false;
      this._deductions = { ...DEFAULT_DEDUCTIONS };
    }
    this.render();
  }

  private handleDeductionChange(field: keyof TaxDeductionInputs, value: number): void {
    this._deductions[field] = Math.max(0, value);
    this.render();
  }

  private toggleDeductionEditor(): void {
    this._showDeductionEditor = !this._showDeductionEditor;
    this.render();
  }

  private renderGatekeeperNotice(): string {
    return `
      <div class="ais-tax-calc-notice-card">
        <div class="ais-tax-notice-left">
          <i data-lucide="info" class="ais-tax-notice-icon"></i>
          <div>
            <h4 class="ais-tax-notice-title">ITR-1 Tax Calculation Bypassed (ITR-2 Applicable)</h4>
            <p class="ais-tax-notice-desc">
              This taxpayer is categorized under <strong>Form ITR-2</strong> (due to capital gains, foreign assets, multiple house properties, or statutory checklist selections). Complex capital gains schedules and business ledgers must be calculated through full ITR-2 filing schedules.
            </p>
          </div>
        </div>
        <span class="meta-pill">Requires Form ITR-2</span>
      </div>
    `;
  }

  private renderHeader(): string {
    return `
      <div class="ais-part-header">
        <div class="ais-part-title-wrap">
          <i data-lucide="calculator" class="ais-part-icon" style="color:var(--ksv-ds-color-emerald-500);"></i>
          <div>
            <h3 class="ais-part-title">
              Tax Payable & Dual-Regime Optimizer (AY 2026-27)
            </h3>
            <p class="text-xs text-secondary mt-1">
              Comparative income tax calculation for Salaried & Other Sources (ITR-1 Sahaj Category)
            </p>
          </div>
        </div>
        <div class="ais-itr-header-badges">
          <span class="ais-itr-badge ais-itr-badge--success">
            ITR-1 Compatible
          </span>
          <span class="meta-pill">
            Assessment Year 2026-27
          </span>
        </div>
      </div>
    `;
  }

  private renderRibbon(comp: DualRegimeTaxComparison): string {
    return `
      <div class="ais-tax-ribbon">
        <div class="ais-tax-ribbon-item">
          <span class="ais-ribbon-label">Salary Income (TDS-192)</span>
          <span class="ais-ribbon-val text-primary">${formatInr(comp.salaryIncome)}</span>
        </div>
        <div class="ais-tax-ribbon-item">
          <span class="ais-ribbon-label">Non-Salary (Interest/Div)</span>
          <span class="ais-ribbon-val text-primary">${formatInr(comp.nonSalaryIncome)}</span>
        </div>
        <div class="ais-tax-ribbon-item">
          <span class="ais-ribbon-label">Gross Total Income (GTI)</span>
          <span class="ais-ribbon-val text-brand font-bold">${formatInr(comp.grossTotalIncome)}</span>
        </div>
        <div class="ais-tax-ribbon-item">
          <span class="ais-ribbon-label">Pre-Paid Taxes (TDS + Challan)</span>
          <span class="ais-ribbon-val font-bold" style="color:var(--ksv-ds-status-success-icon);">
            ${formatInr(comp.totalPrePaidTax)}
          </span>
        </div>
      </div>
    `;
  }

  private renderNetStatusBadge(status: 'PAYABLE' | 'REFUND' | 'NIL', amount: number): string {
    if (status === 'REFUND') {
      return `
        <div class="ais-net-badge ais-net-badge--refund">
          <i data-lucide="arrow-down-left" class="btn-icon-xs"></i>
          <span>Refund Due: ${formatInr(Math.abs(amount))}</span>
        </div>
      `;
    }
    if (status === 'PAYABLE') {
      return `
        <div class="ais-net-badge ais-net-badge--payable">
          <i data-lucide="arrow-up-right" class="btn-icon-xs"></i>
          <span>Tax Payable: ${formatInr(amount)}</span>
        </div>
      `;
    }
    return `
      <div class="ais-net-badge ais-net-badge--nil">
        <i data-lucide="check" class="btn-icon-xs"></i>
        <span>Nil Balance</span>
      </div>
    `;
  }

  private renderSavingsBadge(isWinner: boolean, taxSavings: number): string {
    if (!isWinner) return '';
    return `
      <span class="ais-savings-badge">
        <i data-lucide="sparkles" class="btn-icon-xs"></i>
        Recommended &bull; Saves ${formatInr(taxSavings)}
      </span>
    `;
  }

  private renderNewRegimeCard(comp: DualRegimeTaxComparison, isSelected: boolean): string {
    const isWinner = comp.recommendedRegime === 'NEW';
    const cardSelectedClass = isSelected ? 'ais-regime-card--selected' : '';
    const buttonClass = isSelected ? 'btn-primary' : 'btn-secondary';
    const buttonText = isSelected ? '✓ Selected Regime' : 'Choose New Regime';
    const rebateDisplay = comp.newRegime.rebate87A > 0 ? `-${formatInr(comp.newRegime.rebate87A)}` : '₹0';

    return `
      <div class="ais-regime-card ${cardSelectedClass}">
        <div class="ais-regime-card-header">
          <div>
            <div class="flex items-center gap-2">
              <h4 class="ais-regime-card-title">New Tax Regime</h4>
              <span class="meta-pill text-xs">Section 115BAC (Default)</span>
            </div>
            <p class="text-xs text-secondary mt-1">Higher ₹75,000 std deduction & revised AY 2026-27 slabs</p>
          </div>
          ${this.renderSavingsBadge(isWinner, comp.taxSavings)}
        </div>

        <div class="ais-regime-table">
          <div class="ais-regime-row">
            <span class="text-secondary">Standard Deduction</span>
            <span class="font-medium text-primary">-${formatInr(comp.newRegime.standardDeduction)}</span>
          </div>
          <div class="ais-regime-row">
            <span class="text-secondary">Chapter VI-A Deductions</span>
            <span class="text-tertiary">Not Allowed</span>
          </div>
          <div class="ais-regime-row ais-regime-row--bold">
            <span class="text-primary font-semibold">Net Taxable Income</span>
            <span class="text-primary font-bold">${formatInr(comp.newRegime.taxableIncome)}</span>
          </div>
          <div class="ais-regime-row">
            <span class="text-secondary">Slab Tax Liability</span>
            <span>${formatInr(comp.newRegime.slabTax)}</span>
          </div>
          <div class="ais-regime-row">
            <span class="text-secondary">Rebate u/s 87A (Up to ₹7L)</span>
            <span style="color:var(--ksv-ds-status-success-icon);">${rebateDisplay}</span>
          </div>
          <div class="ais-regime-row">
            <span class="text-secondary">Health & Education Cess (4%)</span>
            <span>${formatInr(comp.newRegime.cess)}</span>
          </div>
          <div class="ais-regime-row ais-regime-row--total">
            <span class="font-bold text-primary">Total Tax Liability</span>
            <span class="font-bold text-primary">${formatInr(comp.newRegime.totalTaxLiability)}</span>
          </div>
          <div class="ais-regime-row">
            <span class="text-secondary">Less: Pre-Paid Tax Credits</span>
            <span style="color:var(--ksv-ds-status-success-icon);">-${formatInr(comp.totalPrePaidTax)}</span>
          </div>
        </div>

        <div class="ais-regime-bottom">
          ${this.renderNetStatusBadge(comp.newRegime.status, comp.newRegime.netPayableOrRefund)}
          <button type="button" class="btn btn-sm ${buttonClass} btn-select-new">
            ${buttonText}
          </button>
        </div>
      </div>
    `;
  }

  private renderOldRegimeCard(comp: DualRegimeTaxComparison, isSelected: boolean): string {
    const isWinner = comp.recommendedRegime === 'OLD';
    const cardSelectedClass = isSelected ? 'ais-regime-card--selected' : '';
    const buttonClass = isSelected ? 'btn-primary' : 'btn-secondary';
    const buttonText = isSelected ? '✓ Selected Regime' : 'Choose Old Regime';
    const rebateDisplay = comp.oldRegime.rebate87A > 0 ? `-${formatInr(comp.oldRegime.rebate87A)}` : '₹0';

    return `
      <div class="ais-regime-card ${cardSelectedClass}">
        <div class="ais-regime-card-header">
          <div>
            <div class="flex items-center gap-2">
              <h4 class="ais-regime-card-title">Old Tax Regime</h4>
              <span class="meta-pill text-xs">Optional Choice</span>
            </div>
            <p class="text-xs text-secondary mt-1">₹50,000 std deduction + Chapter VI-A deductions (80C, 80D, 24b)</p>
          </div>
          ${this.renderSavingsBadge(isWinner, comp.taxSavings)}
        </div>

        <div class="ais-regime-table">
          <div class="ais-regime-row">
            <span class="text-secondary">Standard Deduction</span>
            <span class="font-medium text-primary">-${formatInr(comp.oldRegime.standardDeduction)}</span>
          </div>
          <div class="ais-regime-row">
            <span class="text-secondary">Chapter VI-A Deductions</span>
            <span class="font-medium text-primary">-${formatInr(comp.oldRegime.eligibleDeductions)}</span>
          </div>
          <div class="ais-regime-row ais-regime-row--bold">
            <span class="text-primary font-semibold">Net Taxable Income</span>
            <span class="text-primary font-bold">${formatInr(comp.oldRegime.taxableIncome)}</span>
          </div>
          <div class="ais-regime-row">
            <span class="text-secondary">Slab Tax Liability</span>
            <span>${formatInr(comp.oldRegime.slabTax)}</span>
          </div>
          <div class="ais-regime-row">
            <span class="text-secondary">Rebate u/s 87A (Up to ₹5L)</span>
            <span style="color:var(--ksv-ds-status-success-icon);">${rebateDisplay}</span>
          </div>
          <div class="ais-regime-row">
            <span class="text-secondary">Health & Education Cess (4%)</span>
            <span>${formatInr(comp.oldRegime.cess)}</span>
          </div>
          <div class="ais-regime-row ais-regime-row--total">
            <span class="font-bold text-primary">Total Tax Liability</span>
            <span class="font-bold text-primary">${formatInr(comp.oldRegime.totalTaxLiability)}</span>
          </div>
          <div class="ais-regime-row">
            <span class="text-secondary">Less: Pre-Paid Tax Credits</span>
            <span style="color:var(--ksv-ds-status-success-icon);">-${formatInr(comp.totalPrePaidTax)}</span>
          </div>
        </div>

        <div class="ais-regime-bottom">
          ${this.renderNetStatusBadge(comp.oldRegime.status, comp.oldRegime.netPayableOrRefund)}
          <button type="button" class="btn btn-sm ${buttonClass} btn-select-old">
            ${buttonText}
          </button>
        </div>
      </div>
    `;
  }

  private renderSelectedHeadline(status: 'PAYABLE' | 'REFUND' | 'NIL', amount: number): string {
    if (status === 'REFUND') {
      return `Estimated Income Tax Refund: <span style="color:var(--ksv-ds-status-success-icon); font-weight:800;">${formatInr(Math.abs(amount))}</span>`;
    }
    if (status === 'PAYABLE') {
      return `Estimated Tax Payable Before Filing: <span style="color:var(--ksv-ds-status-warning-text); font-weight:800;">${formatInr(amount)}</span>`;
    }
    return `Zero Tax Balance (All Taxes Settled): <span style="color:var(--ksv-ds-status-success-icon); font-weight:800;">₹0</span>`;
  }

  private renderSelectedSummaryBox(comp: DualRegimeTaxComparison, activeBreakdown: RegimeTaxBreakdown): string {
    const isOldRegime = activeBreakdown.regime === 'OLD';
    const toggleButtonText = this._showDeductionEditor ? 'Hide Old Regime Deductions' : 'Customize Deductions (80C / 80D / NPS)';

    let actionElement: string;
    if (isOldRegime) {
      actionElement = `
        <button type="button" class="btn btn-secondary btn-sm btn-toggle-deductions">
          <i data-lucide="sliders" class="btn-icon-xs"></i>
          <span>${toggleButtonText}</span>
        </button>
      `;
    } else {
      actionElement = `
        <span class="meta-pill text-xs flex items-center gap-1.5" title="Section 115BAC disallows Chapter VI-A deductions under New Tax Regime">
          <i data-lucide="info" class="btn-icon-xs"></i>
          Chapter VI-A Deductions Not Applicable (Sec 115BAC)
        </span>
      `;
    }

    return `
      <div class="ais-selected-summary-box">
        <div class="ais-selected-summary-left">
          <div class="ais-selected-tag">
            Active Selection: <strong>${activeBreakdown.regimeName}</strong>
          </div>
          <div class="ais-selected-headline">
            ${this.renderSelectedHeadline(activeBreakdown.status, activeBreakdown.netPayableOrRefund)}
          </div>
          <p class="text-xs text-secondary mt-1">
            Calculated on Gross Total Income of ${formatInr(comp.grossTotalIncome)} minus pre-paid TDS (${formatInr(comp.totalTdsDeposited)}) & Challans (${formatInr(comp.totalChallanTaxPaid)}).
          </p>
        </div>

        ${actionElement}
      </div>
    `;
  }

  private renderDeductionsEditor(): string {
    return `
      <div class="ais-deductions-editor">
        <div class="ais-deductions-header">
          <div class="flex items-center justify-between w-full">
            <h5 class="text-sm font-bold text-primary flex items-center gap-2">
              <i data-lucide="shield-check" class="btn-icon-sm text-brand"></i>
              Customize Old Regime Deductions (Chapter VI-A)
            </h5>
            <button type="button" class="btn btn-secondary btn-xs btn-reset-deductions">
              <i data-lucide="rotate-ccw" class="btn-icon-xs"></i>
              Reset to ₹0
            </button>
          </div>
          <span class="text-xs text-secondary mt-1">
            Enter amounts to evaluate how your investments impact Old Regime tax savings in real-time (not applicable to New Regime).
          </span>
        </div>

        <div class="ais-deductions-grid">
          <div class="form-group">
            <label class="form-label" for="ded_80c">
              Section 80C (PPF, ELSS, EPF, LIC) &bull; Max ₹1,50,000
            </label>
            <input
              type="number"
              id="ded_80c"
              class="form-input ded-input"
              data-field="section80C"
              value="${this._deductions.section80C || ''}"
              placeholder="e.g. 150000"
              min="0"
              max="150000"
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="ded_80d">
              Section 80D (Health Insurance Premium) &bull; Max ₹75,000
            </label>
            <input
              type="number"
              id="ded_80d"
              class="form-input ded-input"
              data-field="section80D"
              value="${this._deductions.section80D || ''}"
              placeholder="e.g. 25000"
              min="0"
              max="75000"
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="ded_80ccd1b">
              Section 80CCD(1B) (NPS Tier 1 Additional) &bull; Max ₹50,000
            </label>
            <input
              type="number"
              id="ded_80ccd1b"
              class="form-input ded-input"
              data-field="section80Ccd1b"
              value="${this._deductions.section80Ccd1b || ''}"
              placeholder="e.g. 50000"
              min="0"
              max="50000"
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="ded_24b">
              Section 24(b) (Home Loan Interest) &bull; Max ₹2,00,000
            </label>
            <input
              type="number"
              id="ded_24b"
              class="form-input ded-input"
              data-field="section24b"
              value="${this._deductions.section24b || ''}"
              placeholder="e.g. 200000"
              min="0"
              max="200000"
            />
          </div>
        </div>
      </div>
    `;
  }

  private renderTipsBox(tips: string[]): string {
    return `
      <div class="ais-tax-tips-box">
        <div class="ais-tax-tips-title">
          <i data-lucide="lightbulb" class="btn-icon-sm" style="color:var(--ksv-ds-color-amber-500);"></i>
          <span>Actionable Tax Optimization & Savings Guidance</span>
        </div>
        <ul class="ais-tax-tips-list">
          ${tips.map(tip => `
            <li class="ais-tax-tip-item">
              <i data-lucide="check-circle-2" class="btn-icon-xs text-brand flex-shrink-0 mt-0.5"></i>
              <span>${escapeHtml(tip)}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  private attachCalculatorListeners(): void {
    this.querySelector('.btn-select-new')?.addEventListener('click', () => this.handleRegimeSelect('NEW'));
    this.querySelector('.btn-select-old')?.addEventListener('click', () => this.handleRegimeSelect('OLD'));
    this.querySelector('.btn-toggle-deductions')?.addEventListener('click', () => this.toggleDeductionEditor());
    this.querySelector('.btn-reset-deductions')?.addEventListener('click', () => {
      this._deductions = { ...DEFAULT_DEDUCTIONS };
      this.render();
    });

    const dedInputs = this.querySelectorAll<HTMLInputElement>('.ded-input');
    dedInputs.forEach(input => {
      input.addEventListener('input', () => {
        const field = input.dataset.field as keyof TaxDeductionInputs;
        const val = Number.parseFloat(input.value) || 0;
        if (field) {
          this._deductions[field] = Math.max(0, val);
        }
      });
      input.addEventListener('change', () => {
        const field = input.dataset.field as keyof TaxDeductionInputs;
        const val = Number.parseFloat(input.value) || 0;
        if (field) {
          this.handleDeductionChange(field, val);
        }
      });
    });
  }

  render(): void {
    if (!this._aisData) {
      this.innerHTML = '';
      this.style.display = 'none';
      return;
    }

    this.style.display = 'block';
    this.className = 'ais-part-section ais-tax-calculator-section';

    if (!this._isEligibleForItr1) {
      this.innerHTML = this.renderGatekeeperNotice();
      createIcons({ icons, root: this });
      return;
    }

    const comp = calculateTaxComparison(this._aisData, this._deductions, true);
    const activeRegime = this._selectedRegime || comp.recommendedRegime;
    const activeBreakdown = activeRegime === 'NEW' ? comp.newRegime : comp.oldRegime;

    this.innerHTML = `
      ${this.renderHeader()}
      ${this.renderRibbon(comp)}
      <div class="ais-regime-grid">
        ${this.renderNewRegimeCard(comp, activeRegime === 'NEW')}
        ${this.renderOldRegimeCard(comp, activeRegime === 'OLD')}
      </div>
      ${this.renderSelectedSummaryBox(comp, activeBreakdown)}
      ${this._showDeductionEditor && activeRegime === 'OLD' ? this.renderDeductionsEditor() : ''}
      ${this.renderTipsBox(comp.taxOptimizationTips)}
    `;

    this.attachCalculatorListeners();
    createIcons({ icons, root: this });
  }
}

if (!customElements.get('ais-tax-calculator')) {
  customElements.define('ais-tax-calculator', AisTaxCalculator);
}
