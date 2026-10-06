/**
 * Tax Calculation & Regime Comparison Engine (AY 2026-27)
 * 100% Client-Side / Pure TypeScript Implementation
 *
 * Exclusively designed for taxpayers falling under ITR-1 (Sahaj).
 * Bypassed/deferred for ITR-2 / ITR-3 / ITR-4.
 */

import type { AisDeveloperSchema } from '../types/ais';

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
  status: 'PAYABLE' | 'REFUND' | 'NIL';
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

export const DEFAULT_DEDUCTIONS: TaxDeductionInputs = {
  section80C: 0,
  section80D: 0,
  section80Ccd1b: 0,
  section80Tta: 0,
  section24b: 0,
  otherDeductions: 0
};

/**
 * Extract decomposed incomes and pre-paid tax credits directly from AIS Schema
 */
export function extractAisIncomeSummary(ais: AisDeveloperSchema | null | undefined): {
  salaryIncome: number;
  nonSalaryIncome: number;
  grossTotalIncome: number;
  totalTdsDeposited: number;
  totalChallanTaxPaid: number;
  totalPrePaidTax: number;
} {
  if (!ais) {
    return {
      salaryIncome: 0,
      nonSalaryIncome: 0,
      grossTotalIncome: 0,
      totalTdsDeposited: 0,
      totalChallanTaxPaid: 0,
      totalPrePaidTax: 0
    };
  }

  const b1 = ais.part_b1_tds_tcs_transactions ?? [];
  const b3 = ais.part_b3_tax_payments ?? [];

  let salaryIncome = 0;
  let nonSalaryIncome = 0;
  let totalTdsDeposited = 0;

  for (const txn of b1) {
    const code = (txn.information_code || '').toUpperCase();
    const amount = Number(txn.total_amount_credited) || 0;

    // Check if salary signature (TDS-192 or 192)
    if (code.includes('192') || code.includes('SAL')) {
      salaryIncome += amount;
    } else {
      nonSalaryIncome += amount;
    }

    // Accumulate pre-paid TDS credits
    for (const item of txn.line_items ?? []) {
      totalTdsDeposited += Number(item.tds_deposited || item.tds_deducted) || 0;
    }
  }

  // Accumulate pre-paid challans (advance tax, self-assessment tax)
  let totalChallanTaxPaid = 0;
  for (const challan of b3) {
    totalChallanTaxPaid += Number(challan.tax_amount) || 0;
  }

  const grossTotalIncome = salaryIncome + nonSalaryIncome;
  const totalPrePaidTax = totalTdsDeposited + totalChallanTaxPaid;

  return {
    salaryIncome,
    nonSalaryIncome,
    grossTotalIncome,
    totalTdsDeposited,
    totalChallanTaxPaid,
    totalPrePaidTax
  };
}

/**
 * Compute Tax under New Tax Regime (Section 115BAC - AY 2026-27)
 * Slabs: 0-3L (0%), 3L-7L (5%), 7L-10L (10%), 10L-12L (15%), 12L-15L (20%), >15L (30%)
 * Rebate 87A: Up to ₹25,000 for taxable income <= ₹7,00,000
 */
export function computeNewRegimeTax(taxableIncome: number): {
  slabTax: number;
  rebate87A: number;
  taxAfterRebate: number;
  cess: number;
  totalTax: number;
} {
  const roundedIncome = Math.max(0, Math.round(taxableIncome / 10) * 10);
  let slabTax = 0;

  if (roundedIncome > 1500000) {
    slabTax += (roundedIncome - 1500000) * 0.30;
    slabTax += 300000 * 0.20; // 12L - 15L
    slabTax += 200000 * 0.15; // 10L - 12L
    slabTax += 300000 * 0.10; // 7L - 10L
    slabTax += 400000 * 0.05; // 3L - 7L
  } else if (roundedIncome > 1200000) {
    slabTax += (roundedIncome - 1200000) * 0.20;
    slabTax += 200000 * 0.15;
    slabTax += 300000 * 0.10;
    slabTax += 400000 * 0.05;
  } else if (roundedIncome > 1000000) {
    slabTax += (roundedIncome - 1000000) * 0.15;
    slabTax += 300000 * 0.10;
    slabTax += 400000 * 0.05;
  } else if (roundedIncome > 700000) {
    slabTax += (roundedIncome - 700000) * 0.10;
    slabTax += 400000 * 0.05;
  } else if (roundedIncome > 300000) {
    slabTax += (roundedIncome - 300000) * 0.05;
  }

  slabTax = Math.round(slabTax);

  // Section 87A Rebate: Full rebate if income <= 7,00,000
  let rebate87A = 0;
  if (roundedIncome <= 700000) {
    rebate87A = slabTax;
  } else if (roundedIncome > 700000 && roundedIncome <= 727777) {
    // Marginal relief under Section 87A
    const excessIncome = roundedIncome - 700000;
    if (slabTax > excessIncome) {
      rebate87A = slabTax - excessIncome;
    }
  }

  const taxAfterRebate = Math.max(0, slabTax - rebate87A);
  const cess = Math.round(taxAfterRebate * 0.04);
  const totalTax = taxAfterRebate + cess;

  return { slabTax, rebate87A, taxAfterRebate, cess, totalTax };
}

/**
 * Compute Tax under Old Tax Regime (Optional - AY 2026-27)
 * Slabs: 0-2.5L (0%), 2.5L-5L (5%), 5L-10L (20%), >10L (30%)
 * Rebate 87A: Up to ₹12,500 for taxable income <= ₹5,00,000
 */
export function computeOldRegimeTax(taxableIncome: number): {
  slabTax: number;
  rebate87A: number;
  taxAfterRebate: number;
  cess: number;
  totalTax: number;
} {
  const roundedIncome = Math.max(0, Math.round(taxableIncome / 10) * 10);
  let slabTax = 0;

  if (roundedIncome > 1000000) {
    slabTax += (roundedIncome - 1000000) * 0.30;
    slabTax += 500000 * 0.20; // 5L - 10L
    slabTax += 250000 * 0.05; // 2.5L - 5L
  } else if (roundedIncome > 500000) {
    slabTax += (roundedIncome - 500000) * 0.20;
    slabTax += 250000 * 0.05;
  } else if (roundedIncome > 250000) {
    slabTax += (roundedIncome - 250000) * 0.05;
  }

  slabTax = Math.round(slabTax);

  // Section 87A Rebate: Full rebate if income <= 5,00,000
  let rebate87A = 0;
  if (roundedIncome <= 500000) {
    rebate87A = slabTax;
  }

  const taxAfterRebate = Math.max(0, slabTax - rebate87A);
  const cess = Math.round(taxAfterRebate * 0.04);
  const totalTax = taxAfterRebate + cess;

  return { slabTax, rebate87A, taxAfterRebate, cess, totalTax };
}

/**
 * Calculate Dual-Regime Comparison & Optimization Advisory
 */
export function calculateTaxComparison(
  ais: AisDeveloperSchema | null | undefined,
  deductions: TaxDeductionInputs = DEFAULT_DEDUCTIONS,
  isEligibleForItr1 = true
): DualRegimeTaxComparison {
  const summary = extractAisIncomeSummary(ais);
  const { salaryIncome, nonSalaryIncome, grossTotalIncome, totalTdsDeposited, totalChallanTaxPaid, totalPrePaidTax } = summary;

  // 1. New Tax Regime Computation
  const standardDeductionNew = Math.min(salaryIncome, 75000); // ₹75,000 under AY 2026-27
  const taxableIncomeNew = Math.max(0, (salaryIncome - standardDeductionNew) + nonSalaryIncome);
  const newTaxRes = computeNewRegimeTax(taxableIncomeNew);
  const netNew = newTaxRes.totalTax - totalPrePaidTax;

function getTaxStatus(netBalance: number): 'PAYABLE' | 'REFUND' | 'NIL' {
  if (netBalance > 0) return 'PAYABLE';
  if (netBalance < 0) return 'REFUND';
  return 'NIL';
}

  const newRegime: RegimeTaxBreakdown = {
    regime: 'NEW',
    regimeName: 'New Tax Regime (Sec 115BAC)',
    grossTotalIncome,
    salaryIncome,
    nonSalaryIncome,
    standardDeduction: standardDeductionNew,
    eligibleDeductions: 0,
    taxableIncome: taxableIncomeNew,
    slabTax: newTaxRes.slabTax,
    rebate87A: newTaxRes.rebate87A,
    taxAfterRebate: newTaxRes.taxAfterRebate,
    cess: newTaxRes.cess,
    totalTaxLiability: newTaxRes.totalTax,
    totalPrePaidTax,
    netPayableOrRefund: netNew,
    status: getTaxStatus(netNew)
  };

  // 2. Old Tax Regime Computation
  const standardDeductionOld = Math.min(salaryIncome, 50000); // ₹50,000 under Old Regime
  const capped80C = Math.min(Math.max(0, deductions.section80C), 150000);
  const capped80D = Math.min(Math.max(0, deductions.section80D), 75000);
  const capped80Ccd1b = Math.min(Math.max(0, deductions.section80Ccd1b), 50000);
  const capped80Tta = Math.min(Math.max(0, deductions.section80Tta), 10000);
  const capped24b = Math.min(Math.max(0, deductions.section24b), 200000);
  const otherDed = Math.max(0, deductions.otherDeductions);

  const totalDeductionsOld = capped80C + capped80D + capped80Ccd1b + capped80Tta + capped24b + otherDed;
  const taxableIncomeOld = Math.max(0, (salaryIncome - standardDeductionOld - totalDeductionsOld) + nonSalaryIncome);
  const oldTaxRes = computeOldRegimeTax(taxableIncomeOld);
  const netOld = oldTaxRes.totalTax - totalPrePaidTax;

  const oldRegime: RegimeTaxBreakdown = {
    regime: 'OLD',
    regimeName: 'Old Tax Regime (Optional)',
    grossTotalIncome,
    salaryIncome,
    nonSalaryIncome,
    standardDeduction: standardDeductionOld,
    eligibleDeductions: totalDeductionsOld,
    taxableIncome: taxableIncomeOld,
    slabTax: oldTaxRes.slabTax,
    rebate87A: oldTaxRes.rebate87A,
    taxAfterRebate: oldTaxRes.taxAfterRebate,
    cess: oldTaxRes.cess,
    totalTaxLiability: oldTaxRes.totalTax,
    totalPrePaidTax,
    netPayableOrRefund: netOld,
    status: getTaxStatus(netOld)
  };

  // 3. Recommended Regime Determination
  const recommendedRegime: 'NEW' | 'OLD' = (newRegime.totalTaxLiability <= oldRegime.totalTaxLiability) ? 'NEW' : 'OLD';
  const taxSavings = Math.abs(oldRegime.totalTaxLiability - newRegime.totalTaxLiability);

  // 4. Actionable Tax Optimization Tips
  const taxOptimizationTips: string[] = [];

  if (recommendedRegime === 'NEW') {
    taxOptimizationTips.push(
      'New Regime provides a ₹75,000 standard deduction (₹25k higher than Old Regime) with zero investment lock-ins.'
    );
    if (grossTotalIncome <= 775000) {
      taxOptimizationTips.push(
        'Zero Tax Alert: Taxable income up to ₹7,00,000 receives full Section 87A rebate (gross salary up to ₹7.75 Lakh pays ₹0 tax).'
      );
    } else {
      taxOptimizationTips.push(
        'To beat New Regime, you would need significantly higher Chapter VI-A deductions (80C + 80D + HRA + NPS).'
      );
    }
  } else {
    taxOptimizationTips.push(
      `Old Regime is saving you ₹${taxSavings.toLocaleString('en-IN')} thanks to your deductions under Section 80C/80D/24(b).`
    );
  }

  taxOptimizationTips.push(
    'NPS Tier-1 (Sec 80CCD(1B)): An extra deduction up to ₹50,000 is available under the Old Regime beyond the 80C limit.'
  );
  taxOptimizationTips.push(
    'Health Insurance (Sec 80D): Claim up to ₹25,000 for family plus up to ₹50,000 for senior citizen parents under Old Regime.'
  );

  return {
    isEligibleForItr1,
    salaryIncome,
    nonSalaryIncome,
    grossTotalIncome,
    totalTdsDeposited,
    totalChallanTaxPaid,
    totalPrePaidTax,
    newRegime,
    oldRegime,
    recommendedRegime,
    taxSavings,
    taxOptimizationTips
  };
}
