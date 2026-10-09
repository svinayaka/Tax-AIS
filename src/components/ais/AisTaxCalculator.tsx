import React, { useState } from 'react';
import {
  Calculator,
  Sparkles,
  Sliders,
  ShieldCheck,
  RotateCcw,
  Lightbulb,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Info,
} from 'lucide-react';
import type { AisDeveloperSchema } from '../../types/ais';
import { formatInr } from '../../lib/dom-utils';
import {
  calculateTaxComparison,
  evaluateCalculatorEligibility,
  DEFAULT_DEDUCTIONS,
  type TaxDeductionInputs,
  type DualRegimeTaxComparison,
  type RegimeTaxBreakdown,
} from '../../lib/tax-calculator';

export interface AisTaxCalculatorProps {
  data: AisDeveloperSchema | null;
  isEligibleForItr1: boolean;
  id?: string;
}

function GatekeeperNotice({
  isEligibleForItr1,
  reasons,
}: Readonly<{
  isEligibleForItr1: boolean;
  reasons: readonly string[];
}>) {
  const isItr2 = !isEligibleForItr1;
  const title = isItr2
    ? 'ITR-1 Tax Calculation Bypassed (ITR-2 Applicable)'
    : 'Tax Calculation Unsupported for Taxpayer Profile';
  const pill = isItr2 ? 'Requires Form ITR-2' : 'Unsupported Profile';

  return (
    <div className="ais-tax-calc-notice-card">
      <div className="ais-tax-notice-left">
        <Info className="ais-tax-notice-icon" size={24} />
        <div>
          <h4 className="ais-tax-notice-title">{title}</h4>
          <p className="ais-tax-notice-desc">
            {reasons.length > 0 ? (
              reasons.map((r, i) => (
                <span key={i}>
                  {r}
                  <br />
                </span>
              ))
            ) : (
              <span>
                This taxpayer is categorized under <strong>Form ITR-2</strong> (due
                to capital gains, foreign assets, multiple house properties, or
                statutory checklist selections). Complex capital gains schedules
                and business ledgers must be calculated through full ITR-2 filing
                schedules.
              </span>
            )}
          </p>
        </div>
      </div>
      <span className="meta-pill">{pill}</span>
    </div>
  );
}

function IncomeRibbon({ comp }: Readonly<{ comp: DualRegimeTaxComparison }>) {
  return (
    <div className="ais-tax-ribbon">
      <div className="ais-tax-ribbon-item">
        <span className="ais-ribbon-label">Salary Income (TDS-192)</span>
        <span className="ais-ribbon-val text-primary">
          {formatInr(comp.salaryIncome)}
        </span>
      </div>
      <div className="ais-tax-ribbon-item">
        <span className="ais-ribbon-label">Non-Salary (Interest/Div)</span>
        <span className="ais-ribbon-val text-primary">
          {formatInr(comp.nonSalaryIncome)}
        </span>
      </div>
      <div className="ais-tax-ribbon-item">
        <span className="ais-ribbon-label">Gross Total Income (GTI)</span>
        <span className="ais-ribbon-val text-brand font-bold">
          {formatInr(comp.grossTotalIncome)}
        </span>
      </div>
      <div className="ais-tax-ribbon-item">
        <span className="ais-ribbon-label">Pre-Paid Taxes (TDS + Challan)</span>
        <span
          className="ais-ribbon-val font-bold"
          style={{ color: 'var(--ksv-ds-status-success-icon)' }}
        >
          {formatInr(comp.totalPrePaidTax)}
        </span>
      </div>
    </div>
  );
}

function NetStatusBadge({
  status,
  amount,
}: Readonly<{
  status: 'PAYABLE' | 'REFUND' | 'NIL';
  amount: number;
}>) {
  if (status === 'REFUND') {
    return (
      <div className="ais-net-badge ais-net-badge--refund">
        <ArrowDownLeft className="btn-icon-xs" size={14} />
        <span>Refund Due: {formatInr(Math.abs(amount))}</span>
      </div>
    );
  }
  if (status === 'PAYABLE') {
    return (
      <div className="ais-net-badge ais-net-badge--payable">
        <ArrowUpRight className="btn-icon-xs" size={14} />
        <span>Tax Payable: {formatInr(amount)}</span>
      </div>
    );
  }
  return (
    <div className="ais-net-badge ais-net-badge--nil">
      <Check className="btn-icon-xs" size={14} />
      <span>Nil Balance</span>
    </div>
  );
}

function SavingsBadge({
  isWinner,
  taxSavings,
}: Readonly<{
  isWinner: boolean;
  taxSavings: number;
}>) {
  if (!isWinner) return null;
  return (
    <span className="ais-savings-badge">
      <Sparkles className="btn-icon-xs" size={12} />
      Recommended &bull; Saves {formatInr(taxSavings)}
    </span>
  );
}

function NewRegimeCard({
  comp,
  isSelected,
  onSelect,
}: Readonly<{
  comp: DualRegimeTaxComparison;
  isSelected: boolean;
  onSelect: () => void;
}>) {
  const isWinner = comp.recommendedRegime === 'NEW';
  const rebateDisplay =
    comp.newRegime.rebate87A > 0 ? `-${formatInr(comp.newRegime.rebate87A)}` : '₹0';

  return (
    <div
      className={`ais-regime-card ${isSelected ? 'ais-regime-card--selected' : ''}`}
    >
      <div className="ais-regime-card-header">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="ais-regime-card-title">New Tax Regime</h4>
            <span className="meta-pill text-xs">Section 115BAC (Default)</span>
          </div>
          <p className="text-xs text-secondary mt-1">
            Higher ₹75,000 std deduction &amp; revised AY 2026-27 slabs
          </p>
        </div>
        <SavingsBadge isWinner={isWinner} taxSavings={comp.taxSavings} />
      </div>

      <div className="ais-regime-table">
        <div className="ais-regime-row">
          <span className="text-secondary">Standard Deduction</span>
          <span className="font-medium text-primary">
            -{formatInr(comp.newRegime.standardDeduction)}
          </span>
        </div>
        <div className="ais-regime-row">
          <span className="text-secondary">Chapter VI-A Deductions</span>
          <span className="text-tertiary">Not Allowed</span>
        </div>
        <div className="ais-regime-row ais-regime-row--bold">
          <span className="text-primary font-semibold">Net Taxable Income</span>
          <span className="text-primary font-bold">
            {formatInr(comp.newRegime.taxableIncome)}
          </span>
        </div>
        <div className="ais-regime-row">
          <span className="text-secondary">Slab Tax Liability</span>
          <span>{formatInr(comp.newRegime.slabTax)}</span>
        </div>
        <div className="ais-regime-row">
          <span className="text-secondary">Rebate u/s 87A (Up to ₹7L)</span>
          <span style={{ color: 'var(--ksv-ds-status-success-icon)' }}>
            {rebateDisplay}
          </span>
        </div>
        <div className="ais-regime-row">
          <span className="text-secondary">Health &amp; Education Cess (4%)</span>
          <span>{formatInr(comp.newRegime.cess)}</span>
        </div>
        <div className="ais-regime-row ais-regime-row--total">
          <span className="font-bold text-primary">Total Tax Liability</span>
          <span className="font-bold text-primary">
            {formatInr(comp.newRegime.totalTaxLiability)}
          </span>
        </div>
        <div className="ais-regime-row">
          <span className="text-secondary">Less: Pre-Paid Tax Credits</span>
          <span style={{ color: 'var(--ksv-ds-status-success-icon)' }}>
            -{formatInr(comp.totalPrePaidTax)}
          </span>
        </div>
      </div>

      <div className="ais-regime-bottom">
        <NetStatusBadge
          status={comp.newRegime.status}
          amount={comp.newRegime.netPayableOrRefund}
        />
        <button
          type="button"
          className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
          onClick={onSelect}
        >
          {isSelected ? '✓ Selected Regime' : 'Choose New Regime'}
        </button>
      </div>
    </div>
  );
}

function OldRegimeCard({
  comp,
  isSelected,
  onSelect,
}: Readonly<{
  comp: DualRegimeTaxComparison;
  isSelected: boolean;
  onSelect: () => void;
}>) {
  const isWinner = comp.recommendedRegime === 'OLD';
  const rebateDisplay =
    comp.oldRegime.rebate87A > 0 ? `-${formatInr(comp.oldRegime.rebate87A)}` : '₹0';

  return (
    <div
      className={`ais-regime-card ${isSelected ? 'ais-regime-card--selected' : ''}`}
    >
      <div className="ais-regime-card-header">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="ais-regime-card-title">Old Tax Regime</h4>
            <span className="meta-pill text-xs">Optional Choice</span>
          </div>
          <p className="text-xs text-secondary mt-1">
            ₹50,000 std deduction + Chapter VI-A deductions (80C, 80D, 24b)
          </p>
        </div>
        <SavingsBadge isWinner={isWinner} taxSavings={comp.taxSavings} />
      </div>

      <div className="ais-regime-table">
        <div className="ais-regime-row">
          <span className="text-secondary">Standard Deduction</span>
          <span className="font-medium text-primary">
            -{formatInr(comp.oldRegime.standardDeduction)}
          </span>
        </div>
        <div className="ais-regime-row">
          <span className="text-secondary">Chapter VI-A Deductions</span>
          <span className="font-medium text-primary">
            -{formatInr(comp.oldRegime.eligibleDeductions)}
          </span>
        </div>
        <div className="ais-regime-row ais-regime-row--bold">
          <span className="text-primary font-semibold">Net Taxable Income</span>
          <span className="text-primary font-bold">
            {formatInr(comp.oldRegime.taxableIncome)}
          </span>
        </div>
        <div className="ais-regime-row">
          <span className="text-secondary">Slab Tax Liability</span>
          <span>{formatInr(comp.oldRegime.slabTax)}</span>
        </div>
        <div className="ais-regime-row">
          <span className="text-secondary">Rebate u/s 87A (Up to ₹5L)</span>
          <span style={{ color: 'var(--ksv-ds-status-success-icon)' }}>
            {rebateDisplay}
          </span>
        </div>
        <div className="ais-regime-row">
          <span className="text-secondary">Health &amp; Education Cess (4%)</span>
          <span>{formatInr(comp.oldRegime.cess)}</span>
        </div>
        <div className="ais-regime-row ais-regime-row--total">
          <span className="font-bold text-primary">Total Tax Liability</span>
          <span className="font-bold text-primary">
            {formatInr(comp.oldRegime.totalTaxLiability)}
          </span>
        </div>
        <div className="ais-regime-row">
          <span className="text-secondary">Less: Pre-Paid Tax Credits</span>
          <span style={{ color: 'var(--ksv-ds-status-success-icon)' }}>
            -{formatInr(comp.totalPrePaidTax)}
          </span>
        </div>
      </div>

      <div className="ais-regime-bottom">
        <NetStatusBadge
          status={comp.oldRegime.status}
          amount={comp.oldRegime.netPayableOrRefund}
        />
        <button
          type="button"
          className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
          onClick={onSelect}
        >
          {isSelected ? '✓ Selected Regime' : 'Choose Old Regime'}
        </button>
      </div>
    </div>
  );
}

function SelectedHeadline({
  status,
  amount,
}: Readonly<{
  status: 'PAYABLE' | 'REFUND' | 'NIL';
  amount: number;
}>) {
  if (status === 'REFUND') {
    return (
      <>
        Estimated Income Tax Refund:{' '}
        <span
          style={{
            color: 'var(--ksv-ds-status-success-icon)',
            fontWeight: 800,
          }}
        >
          {formatInr(Math.abs(amount))}
        </span>
      </>
    );
  }
  if (status === 'PAYABLE') {
    return (
      <>
        Estimated Tax Payable Before Filing:{' '}
        <span
          style={{
            color: 'var(--ksv-ds-status-warning-text)',
            fontWeight: 800,
          }}
        >
          {formatInr(amount)}
        </span>
      </>
    );
  }
  return (
    <>
      Zero Tax Balance (All Taxes Settled):{' '}
      <span
        style={{
          color: 'var(--ksv-ds-status-success-icon)',
          fontWeight: 800,
        }}
      >
        ₹0
      </span>
    </>
  );
}

function SelectedSummaryBox({
  comp,
  activeBreakdown,
  showDeductionEditor,
  onToggleDeductions,
}: Readonly<{
  comp: DualRegimeTaxComparison;
  activeBreakdown: RegimeTaxBreakdown;
  showDeductionEditor: boolean;
  onToggleDeductions: () => void;
}>) {
  return (
    <div className="ais-selected-summary-box">
      <div className="ais-selected-summary-left">
        <div className="ais-selected-tag">
          Active Selection: <strong>{activeBreakdown.regimeName}</strong>
        </div>
        <div className="ais-selected-headline">
          <SelectedHeadline
            status={activeBreakdown.status}
            amount={activeBreakdown.netPayableOrRefund}
          />
        </div>
        <p className="text-xs text-secondary mt-1">
          Calculated on Gross Total Income of {formatInr(comp.grossTotalIncome)}{' '}
          minus pre-paid TDS ({formatInr(comp.totalTdsDeposited)}) &amp; Challans
          ({formatInr(comp.totalChallanTaxPaid)}).
        </p>
      </div>

      {activeBreakdown.regime === 'OLD' ? (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onToggleDeductions}
        >
          <Sliders className="btn-icon-xs" size={14} />
          <span>
            {showDeductionEditor
              ? 'Hide Old Regime Deductions'
              : 'Customize Deductions (80C / 80D / NPS)'}
          </span>
        </button>
      ) : (
        <span
          className="meta-pill text-xs flex items-center gap-1.5"
          title="Section 115BAC disallows Chapter VI-A deductions under New Tax Regime"
        >
          <Info className="btn-icon-xs" size={12} />
          Chapter VI-A Deductions Not Applicable (Sec 115BAC)
        </span>
      )}
    </div>
  );
}

function DeductionsEditor({
  deductions,
  onChange,
  onReset,
}: Readonly<{
  deductions: TaxDeductionInputs;
  onChange: (field: keyof TaxDeductionInputs, val: number) => void;
  onReset: () => void;
}>) {
  return (
    <div className="ais-deductions-editor">
      <div className="ais-deductions-header">
        <div className="flex items-center justify-between w-full">
          <h5 className="text-sm font-bold text-primary flex items-center gap-2">
            <ShieldCheck className="btn-icon-sm text-brand" size={16} />
            Customize Old Regime Deductions (Chapter VI-A)
          </h5>
          <button
            type="button"
            className="btn btn-secondary btn-xs"
            onClick={onReset}
          >
            <RotateCcw className="btn-icon-xs" size={12} />
            Reset to ₹0
          </button>
        </div>
        <span className="text-xs text-secondary mt-1">
          Enter amounts to evaluate how your investments impact Old Regime tax
          savings in real-time (not applicable to New Regime).
        </span>
      </div>

      <div className="ais-deductions-grid">
        <div className="form-group">
          <label className="form-label" htmlFor="ded_80c">
            Section 80C (PPF, ELSS, EPF, LIC) &bull; Max ₹1,50,000
          </label>
          <input
            type="number"
            id="ded_80c"
            className="form-input"
            value={deductions.section80C || ''}
            placeholder="e.g. 150000"
            min="0"
            max="150000"
            onChange={(e) =>
              onChange('section80C', Number.parseFloat(e.target.value) || 0)
            }
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="ded_80d">
            Section 80D (Health Insurance Premium) &bull; Max ₹75,000
          </label>
          <input
            type="number"
            id="ded_80d"
            className="form-input"
            value={deductions.section80D || ''}
            placeholder="e.g. 25000"
            min="0"
            max="75000"
            onChange={(e) =>
              onChange('section80D', Number.parseFloat(e.target.value) || 0)
            }
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="ded_80ccd1b">
            Section 80CCD(1B) (NPS Tier 1 Additional) &bull; Max ₹50,000
          </label>
          <input
            type="number"
            id="ded_80ccd1b"
            className="form-input"
            value={deductions.section80Ccd1b || ''}
            placeholder="e.g. 50000"
            min="0"
            max="50000"
            onChange={(e) =>
              onChange('section80Ccd1b', Number.parseFloat(e.target.value) || 0)
            }
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="ded_24b">
            Section 24(b) (Home Loan Interest) &bull; Max ₹2,00,000
          </label>
          <input
            type="number"
            id="ded_24b"
            className="form-input"
            value={deductions.section24b || ''}
            placeholder="e.g. 200000"
            min="0"
            max="200000"
            onChange={(e) =>
              onChange('section24b', Number.parseFloat(e.target.value) || 0)
            }
          />
        </div>
      </div>
    </div>
  );
}

function TaxTipsBox({ tips }: Readonly<{ tips: readonly string[] }>) {
  if (tips.length === 0) return null;
  return (
    <div className="ais-tax-tips-box">
      <div className="ais-tax-tips-title">
        <Lightbulb
          className="btn-icon-sm"
          style={{ color: 'var(--ksv-ds-color-amber-500)' }}
          size={18}
        />
        <span>Actionable Tax Optimization &amp; Savings Guidance</span>
      </div>
      <ul className="ais-tax-tips-list">
        {tips.map((tip, idx) => (
          <li key={idx} className="ais-tax-tip-item">
            <CheckCircle2
              className="btn-icon-xs text-brand flex-shrink-0 mt-0.5"
              size={14}
            />
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const AisTaxCalculator: React.FC<Readonly<AisTaxCalculatorProps>> = ({
  data,
  isEligibleForItr1,
  id,
}) => {
  const [selectedRegime, setSelectedRegime] = useState<'NEW' | 'OLD' | null>(
    null
  );
  const [deductions, setDeductions] = useState<TaxDeductionInputs>({
    ...DEFAULT_DEDUCTIONS,
  });
  const [showDeductionEditor, setShowDeductionEditor] = useState<boolean>(false);

  if (!data) return null;

  const eligibility = evaluateCalculatorEligibility(data, isEligibleForItr1);
  if (!eligibility.supported) {
    return (
      <div
        className="ais-part-section ais-tax-calculator-section"
        id={id}
        style={{ display: 'block' }}
      >
        <GatekeeperNotice
          isEligibleForItr1={isEligibleForItr1}
          reasons={eligibility.reasons}
        />
      </div>
    );
  }

  const comp = calculateTaxComparison(data, deductions, true);
  const activeRegime = selectedRegime || comp.recommendedRegime;
  const activeBreakdown =
    activeRegime === 'NEW' ? comp.newRegime : comp.oldRegime;

  const handleRegimeSelect = (regime: 'NEW' | 'OLD') => {
    setSelectedRegime(regime);
    if (regime === 'NEW') {
      setShowDeductionEditor(false);
      setDeductions({ ...DEFAULT_DEDUCTIONS });
    }
  };

  const handleDeductionChange = (
    field: keyof TaxDeductionInputs,
    val: number
  ) => {
    setDeductions((prev) => ({
      ...prev,
      [field]: Math.max(0, val),
    }));
  };

  const resetDeductions = () => {
    setDeductions({ ...DEFAULT_DEDUCTIONS });
  };

  return (
    <div
      className="ais-part-section ais-tax-calculator-section"
      id={id}
      style={{ display: 'block' }}
    >
      {/* Header */}
      <div className="ais-part-header">
        <div className="ais-part-title-wrap">
          <Calculator
            className="ais-part-icon"
            style={{ color: 'var(--ksv-ds-color-emerald-500)' }}
            size={24}
          />
          <div>
            <h3 className="ais-part-title">
              Tax Payable &amp; Dual-Regime Optimizer (AY 2026-27)
            </h3>
            <p className="text-xs text-secondary mt-1">
              Comparative income tax calculation for Salaried &amp; Other
              Sources (ITR-1 Sahaj Category)
            </p>
          </div>
        </div>
        <div className="ais-itr-header-badges">
          <span className="ais-itr-badge ais-itr-badge--success">
            ITR-1 Compatible
          </span>
          <span className="meta-pill">Assessment Year 2026-27</span>
        </div>
      </div>

      {/* Income & Tax Ribbon */}
      <IncomeRibbon comp={comp} />

      {/* Regime Cards Grid */}
      <div className="ais-regime-grid">
        <NewRegimeCard
          comp={comp}
          isSelected={activeRegime === 'NEW'}
          onSelect={() => handleRegimeSelect('NEW')}
        />
        <OldRegimeCard
          comp={comp}
          isSelected={activeRegime === 'OLD'}
          onSelect={() => handleRegimeSelect('OLD')}
        />
      </div>

      {/* Selected Summary Box */}
      <SelectedSummaryBox
        comp={comp}
        activeBreakdown={activeBreakdown}
        showDeductionEditor={showDeductionEditor}
        onToggleDeductions={() => setShowDeductionEditor(!showDeductionEditor)}
      />

      {/* Deductions Editor (Old Regime only) */}
      {showDeductionEditor && activeRegime === 'OLD' && (
        <DeductionsEditor
          deductions={deductions}
          onChange={handleDeductionChange}
          onReset={resetDeductions}
        />
      )}

      {/* Tax Tips Box */}
      <TaxTipsBox tips={comp.taxOptimizationTips} />
    </div>
  );
};
