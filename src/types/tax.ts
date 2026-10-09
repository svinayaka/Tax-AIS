/**
 * Tax Calculation & Regime Types
 * Strict contracts for dual-regime income tax computation and comparison.
 */

export type TaxPositionStatus = 'PAYABLE' | 'REFUND' | 'NIL';

export interface TaxDeductionInputs {
  section80C: number;     // EPF, PPF, ELSS, Life Insurance (cap: ₹1,50,000)
  section80D: number;     // Health Insurance (cap: ₹75,000 total)
  section80Ccd1b: number; // NPS Tier 1 exclusive (cap: ₹50,000)
  section80Tta: number;   // Savings Bank Interest (cap: ₹10,000)
  section24b: number;     // Home loan interest on self-occupied (cap: ₹2,00,000)
  otherDeductions: number;// Other Chapter VI-A deductions
}

export interface RegimeTaxBreakdown {
  regime: 'NEW' | 'OLD';
  regimeName: string;
  grossTotalIncome: number;
  salaryIncome: number;
  nonSalaryIncome: number;
  standardDeduction: number;
  eligibleDeductions: number;
  taxableIncome: number;
  slabTax: number;
  rebate87A: number;
  taxAfterRebate: number;
  cess: number;
  totalTaxLiability: number;
  totalPrePaidTax: number;
  netPayableOrRefund: number;
  status: TaxPositionStatus;
  // Standardized sign convention: positive = tax payable; negative = tax refund claimable
  netTaxPosition: number;
  netTaxStatus: TaxPositionStatus;
}

export interface DualRegimeTaxComparison {
  isEligibleForItr1: boolean;
  salaryIncome: number;
  nonSalaryIncome: number;
  grossTotalIncome: number;
  totalTdsDeposited: number;
  totalChallanTaxPaid: number;
  totalPrePaidTax: number;
  newRegime: RegimeTaxBreakdown;
  oldRegime: RegimeTaxBreakdown;
  recommendedRegime: 'NEW' | 'OLD';
  taxSavings: number;
  taxOptimizationTips: string[];
}

/**
 * Tax computation result breakdown for a specific tax regime (AY 2026-27).
 * Exposes individual statutory tax components explicitly per ARCHITECTURE.md Section 10.10.
 */
export interface RegimeTaxResult {
  grossTotalIncome: number;
  taxableIncome: number;

  incomeTax: number;
  rebate87A: number;

  surchargeBeforeMarginalRelief: number;
  marginalRelief: number;
  surchargeAfterMarginalRelief: number;

  healthEducationCess: number;
  totalTaxLiability: number;

  prepaidTaxes: number;

  // Sign convention: positive indicates tax payable (due); negative indicates tax refund claimable
  netTaxPosition: number;
  netTaxStatus: TaxPositionStatus;
}

export interface CalculatorEligibility {
  supported: boolean;
  reasons: string[];
}
