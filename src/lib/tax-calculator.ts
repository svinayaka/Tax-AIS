/**
 * Tax Calculation & Regime Comparison Engine (AY 2026-27)
 * 100% Client-Side / Pure TypeScript Implementation
 *
 * Exclusively designed for taxpayers falling under ITR-1 (Sahaj).
 * Bypassed/deferred for ITR-2 / ITR-3 / ITR-4.
 */

import type { AisDeveloperSchema, CalculatorEligibility } from '../types/ais';

export interface TaxDeductionInputs {
  section80C: number;     // EPF, PPF, ELSS, Life Insurance (cap: ₹1,50,000)
  section80D: number;     // Health Insurance (cap: ₹75,000 total)
  section80Ccd1b: number; // NPS Tier 1 exclusive (cap: ₹50,000)
  section80Tta: number;   // Savings Bank Interest (cap: ₹10,000)
  section24b: number;     // Home loan interest on self-occupied (cap: ₹2,00,000)
  otherDeductions: number;// Other Chapter VI-A deductions
}

export type TaxPositionStatus = 'PAYABLE' | 'REFUND' | 'NIL';

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

export const DEFAULT_DEDUCTIONS: TaxDeductionInputs = {
  section80C: 0,
  section80D: 0,
  section80Ccd1b: 0,
  section80Tta: 0,
  section24b: 0,
  otherDeductions: 0
};

/**
 * Evaluate whether the taxpayer profile is supported by the current tax calculator.
 * Decoupled from ITR-1 form recommendation per ARCHITECTURE.md Section 10.10.
 */
export function evaluateCalculatorEligibility(
  ais: AisDeveloperSchema | null | undefined,
  isEligibleForItr1: boolean
): CalculatorEligibility {
  const reasons: string[] = [];
  if (!isEligibleForItr1) {
    reasons.push('Taxpayer profile is outside ITR-1 (ITR-2 or higher applicable). Complex capital gains schedules, foreign assets, or business balance sheets require full return filing computation outside ITR-1.');
    return { supported: false, reasons };
  }
  if (!ais) {
    reasons.push('No AIS document data loaded to perform tax calculation.');
    return { supported: false, reasons };
  }
  const sft = ais.part_b2_sft_transactions ?? [];
  const hasCapitalGainsSignal = sft.some(t => {
    const code = (t.information_code || '').toUpperCase();
    return code.includes('SFT-017') || code.includes('SFT-018') || code.includes('LES') || code.includes('EMF');
  });
  if (hasCapitalGainsSignal) {
    reasons.push('Securities activity / Section 112A capital gains present. While limited LTCG (<= ₹1.25 lakh) is compatible with ITR-1 filing, capital gains schedules are not modeled by the current tax calculator.');
  }

  return {
    supported: reasons.length === 0,
    reasons
  };
}

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
 * Slabs: 0-4L (0%), 4L-8L (5%), 8L-12L (10%), 12L-16L (15%), 16L-20L (20%), 20L-24L (25%), >24L (30%)
 * Rebate 87A: Up to ₹60,000 for taxable income <= ₹12,00,000
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

  if (roundedIncome > 2400000) {
    slabTax += (roundedIncome - 2400000) * 0.30;
    slabTax += 400000 * 0.25; // 20L - 24L
    slabTax += 400000 * 0.20; // 16L - 20L
    slabTax += 400000 * 0.15; // 12L - 16L
    slabTax += 400000 * 0.10; // 8L - 12L
    slabTax += 400000 * 0.05; // 4L - 8L
  } else if (roundedIncome > 2000000) {
    slabTax += (roundedIncome - 2000000) * 0.25;
    slabTax += 400000 * 0.20;
    slabTax += 400000 * 0.15;
    slabTax += 400000 * 0.10;
    slabTax += 400000 * 0.05;
  } else if (roundedIncome > 1600000) {
    slabTax += (roundedIncome - 1600000) * 0.20;
    slabTax += 400000 * 0.15;
    slabTax += 400000 * 0.10;
    slabTax += 400000 * 0.05;
  } else if (roundedIncome > 1200000) {
    slabTax += (roundedIncome - 1200000) * 0.15;
    slabTax += 400000 * 0.10;
    slabTax += 400000 * 0.05;
  } else if (roundedIncome > 800000) {
    slabTax += (roundedIncome - 800000) * 0.10;
    slabTax += 400000 * 0.05;
  } else if (roundedIncome > 400000) {
    slabTax += (roundedIncome - 400000) * 0.05;
  }

  slabTax = Math.round(slabTax);

  // Section 87A Rebate: Full rebate up to ₹60,000 if income <= 12,00,000
  let rebate87A = 0;
  if (roundedIncome <= 1200000) {
    rebate87A = Math.min(slabTax, 60000);
  } else if (roundedIncome > 1200000 && roundedIncome <= 1275000) {
    // Marginal relief under Section 87A
    const excessIncome = roundedIncome - 1200000;
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

function getTaxStatus(netBalance: number): TaxPositionStatus {
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
    status: getTaxStatus(netNew),
    netTaxPosition: netNew,
    netTaxStatus: getTaxStatus(netNew)
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
    status: getTaxStatus(netOld),
    netTaxPosition: netOld,
    netTaxStatus: getTaxStatus(netOld)
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
