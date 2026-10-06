/**
 * Deterministic ITR Form Classifier Engine (ITR-1 Sahaj vs ITR-2 Router)
 * Implements the Agent System Directive in src/workers/ROUTER_AGENT.md.
 * Evaluates Indian Income Tax Annual Information Statement (AIS) data against CBDT rules.
 *
 * Privacy: 100% Client-Side In-Browser execution with zero server transmission.
 */

import type {
  StructuredExtractionResult,
  AisDeveloperSchema,
  ItrClassificationResult,
  ItrDetectedFactors,
  ItrFormType,
  ItrChecklistItem,
  PartB1TdsTcsTransaction,
  PartB2SftTransaction
} from '../types/ais';

export const STANDARD_ITR_CHECKLIST: ItrChecklistItem[] = [
  {
    id: 'income_limit_50l',
    question: 'Does your total taxable income exceed ₹50,00,000 (₹50 Lakhs)?',
    impactIfYes: 'Requires ITR-2 (ITR-1 is capped at ₹50 Lakhs total income)'
  },
  {
    id: 'multiple_house_properties',
    question: 'Do you own or earn rental income from more than one house property?',
    impactIfYes: 'Requires ITR-2 (ITR-1 permits only a single house property)'
  },
  {
    id: 'company_directorship',
    question: 'Were you a Director in an Indian or foreign company during the financial year?',
    impactIfYes: 'Requires ITR-2 (Director details mandatory in Part A-General)'
  },
  {
    id: 'unlisted_equity_shares',
    question: 'Did you hold unlisted equity shares at any time during the financial year?',
    impactIfYes: 'Requires ITR-2 (Unlisted equity disclosures required)'
  },
  {
    id: 'foreign_assets_or_income',
    question: 'Do you hold foreign bank accounts, foreign stocks (e.g. RSUs/ESPP), or signing authority abroad?',
    impactIfYes: 'Requires ITR-2 (Schedule FA & FSI disclosures mandatory)'
  },
  {
    id: 'agricultural_income_limit',
    question: 'Does your net agricultural income exceed ₹5,000?',
    impactIfYes: 'Requires ITR-2 (ITR-1 limits agricultural income to ₹5,000)'
  },
  {
    id: 'brought_forward_losses',
    question: 'Do you have brought forward or carry forward losses under any income head?',
    impactIfYes: 'Requires ITR-2 (Schedule CFL mandatory)'
  }
];

function createDefaultFactors(): ItrDetectedFactors {
  return {
    hasCapitalGains: false,
    hasPropertyTransactions: false,
    hasForeignRemittance: false,
    hasLotteryOrGambling: false,
    hasCryptoVda: false,
    hasBusinessOrProfession: false,
    hasSalaryIncome: false,
    hasInterestIncome: false,
    hasDividendIncome: false,
    hasHighCashWithdrawal: false
  };
}

interface IngestedPartB1Metrics {
  salaryGross: number;
  interestGross: number;
  dividendGross: number;
}

function addUniqueTrigger(triggers: string[], msg: string): void {
  if (!triggers.includes(msg)) {
    triggers.push(msg);
  }
}

function processTdsIncome(
  code: string,
  desc: string,
  amount: number,
  factors: ItrDetectedFactors,
  metrics: IngestedPartB1Metrics
): void {
  if (code.includes('192') || desc.includes('salary')) {
    factors.hasSalaryIncome = true;
    metrics.salaryGross += amount;
  }
  if (code.includes('194A') || desc.includes('interest other than') || desc.includes('interest on savings')) {
    factors.hasInterestIncome = true;
    metrics.interestGross += amount;
  }
  if (code.includes('194K') || (code === '194' && desc.includes('dividend')) || desc.includes('dividend')) {
    factors.hasDividendIncome = true;
    metrics.dividendGross += amount;
  }
}

function processTdsDisqualifiers(
  code: string,
  desc: string,
  factors: ItrDetectedFactors,
  triggers: string[]
): void {
  if (code.includes('206CQ') || code.includes('206C(1G)') || code.includes('206C-1G') || desc.includes('remittance') || desc.includes('overseas tour')) {
    factors.hasForeignRemittance = true;
    addUniqueTrigger(triggers, '🚨 Foreign remittance signature tracked: Requires mandatory Schedule FA declaration (Forces ITR-2).');
  }
  if (code.includes('194-IA') || code.includes('194IA') || desc.includes('immovable property')) {
    factors.hasPropertyTransactions = true;
    addUniqueTrigger(triggers, '🏠 Immovable property transfer tracked: Capital gains schedule required (Forces ITR-2).');
  }
  if (code.includes('194B') || code.includes('194BA') || code.includes('194BB') || desc.includes('lottery') || desc.includes('online game')) {
    factors.hasLotteryOrGambling = true;
    addUniqueTrigger(triggers, '🎲 Special rate lottery / online gaming winnings u/s 194B detected (Disallows ITR-1).');
  }
  if (code.includes('194S') || desc.includes('virtual digital') || desc.includes('vda') || desc.includes('crypto')) {
    factors.hasCryptoVda = true;
    addUniqueTrigger(triggers, '🪙 Virtual Digital Asset (Crypto/VDA) transfer u/s 194S detected: Schedule VDA required (Forces ITR-2).');
  }
  if (code.includes('194C') || code.includes('194J') || code.includes('194H') || code.includes('194M') || code.includes('194R')) {
    factors.hasBusinessOrProfession = true;
  }
}

/**
 * Step 2: Ingest & Evaluate Part B1 (TDS / TCS Ledger Logs)
 */
function evaluatePartB1(
  transactions: PartB1TdsTcsTransaction[],
  factors: ItrDetectedFactors,
  routingTriggers: string[]
): IngestedPartB1Metrics {
  const metrics: IngestedPartB1Metrics = { salaryGross: 0, interestGross: 0, dividendGross: 0 };

  for (const item of transactions) {
    const code = (item.information_code || '').toUpperCase();
    const desc = (item.information_description || '').toLowerCase();
    const itemAmount = item.total_amount_credited || item.total_amount || 0;

    processTdsIncome(code, desc, itemAmount, factors, metrics);
    processTdsDisqualifiers(code, desc, factors, routingTriggers);
  }

  return metrics;
}

function isSecuritiesCode(code: string, desc: string): boolean {
  return (
    code.includes('SFT-017') ||
    code.includes('SFT-018') ||
    code.includes('SFT-014') ||
    code.includes('SFT-015') ||
    code.includes('SFT-016') ||
    code.includes('LES') ||
    code.includes('EMF') ||
    code.includes('SAL-SEC') ||
    code.includes('PUR-SEC') ||
    desc.includes('securities') ||
    desc.includes('mutual fund') ||
    desc.includes('equity share') ||
    desc.includes('sale of share') ||
    desc.includes('redemption of unit')
  );
}

function isPropertyCode(code: string, desc: string): boolean {
  return (
    code.includes('SFT-012') ||
    code.includes('SFT-011') ||
    desc.includes('immovable property') ||
    desc.includes('sale of property') ||
    desc.includes('purchase of property')
  );
}

function evaluateSingleSft(
  item: PartB2SftTransaction,
  factors: ItrDetectedFactors,
  routingTriggers: string[]
): void {
  const code = (item.information_code || '').toUpperCase();
  const desc = (item.information_description || '').toLowerCase();

  if (isSecuritiesCode(code, desc)) {
    factors.hasCapitalGains = true;
    addUniqueTrigger(routingTriggers, '📈 Capital Gains/Losses footprint detected: Disallowed under ITR-1 standard conditions.');
  }

  if (code.includes('SFT-019') || desc.includes('unlisted equity')) {
    addUniqueTrigger(routingTriggers, '🚨 Unlisted equity shares held during the year: Legally barred from simple returns.');
  }

  if (isPropertyCode(code, desc)) {
    factors.hasPropertyTransactions = true;
    addUniqueTrigger(routingTriggers, '🏠 Immovable property transfer tracked: Capital gains schedule required (Forces ITR-2).');
  }
}

/**
 * Step 3: Ingest & Evaluate Part B2 (SFT Investment Rails)
 */
function evaluatePartB2(
  transactions: PartB2SftTransaction[],
  factors: ItrDetectedFactors,
  routingTriggers: string[]
): void {
  for (const item of transactions) {
    evaluateSingleSft(item, factors, routingTriggers);
  }
}

/**
 * Step 4: Validate Income Overrun Caps (₹50 Lakh Threshold)
 */
function evaluateIncomeOverrun(
  totalCalculatedIncome: number,
  routingTriggers: string[]
): void {
  const FIFTY_LAKHS_CAP = 5_000_000;
  if (totalCalculatedIncome > FIFTY_LAKHS_CAP) {
    addUniqueTrigger(routingTriggers, '💰 Total calculated income crosses the statutory ₹50 Lakh restriction cap for ITR-1.');
  }
}

function compileEligibleFactors(factors: ItrDetectedFactors): string[] {
  const list: string[] = [];
  if (factors.hasSalaryIncome) {
    list.push('Salary income reported under Section 192');
  }
  if (factors.hasInterestIncome) {
    list.push('Interest income reported under Section 194A (Savings/Fixed Deposits)');
  }
  if (factors.hasDividendIncome) {
    list.push('Dividend income reported under Section 194K / 194');
  }
  return list;
}

/**
 * TaxDiagnosticAgent: Router matrix processing canonical AisDeveloperSchema
 * Executes purely in active browser RAM / Web Worker to segregate ITR-1 vs ITR-2.
 */
export function classifyItr(structuredData: StructuredExtractionResult): ItrClassificationResult {
  const ais = structuredData.aisJson || {} as AisDeveloperSchema;
  const factors = createDefaultFactors();
  const routingTriggers: string[] = [];

  // 🔲 Step 1: Default Baseline Selection
  let targetWorkspace: 'ITR-1' | 'ITR-2' = 'ITR-1';
  let isBarredFromItr1 = false;

  // 🔲 Step 2: Ingest & Evaluate Part B1 (TDS / TCS Ledger Logs)
  const partB1 = ais.part_b1_tds_tcs_transactions || [];
  const { salaryGross, interestGross, dividendGross } = evaluatePartB1(partB1, factors, routingTriggers);

  // 🔲 Step 3: Ingest & Evaluate Part B2 (SFT Investment Rails)
  const partB2 = ais.part_b2_sft_transactions || [];
  evaluatePartB2(partB2, factors, routingTriggers);

  // 🔲 Step 4: Validate Income Overrun Caps
  const calculatedTotalIncome = salaryGross + interestGross + dividendGross;
  evaluateIncomeOverrun(calculatedTotalIncome, routingTriggers);

  // Check if any disqualifier was triggered
  if (routingTriggers.length > 0) {
    isBarredFromItr1 = true;
    targetWorkspace = 'ITR-2';
  }

  // 🔲 Step 5: Scale-Ready Future Hook Slots (ITR-3 / ITR-4 Business Logic)
  // FUTURE HOOK: ITR-4 / ITR-3 Business Logic Matrix
  // - Check for Section 194J / 194C codes in Part B1 (Independent fees / Contract TDS)
  // - Check for GSTR_TURNOVER parameters in Part B2 (GST reported business turnover)
  // - If matching and within presumptive thresholds (<= ₹50L), route to ITR-4
  // - If complex derivatives (F&O / Intraday) or over limits, route to ITR-3

  let recommendedForm: ItrFormType = targetWorkspace;
  let confidence: 'high' | 'provisional';
  let headline = 'ITR-1 (Sahaj) Recommended';
  let summaryReason =
    'Your AIS reflects standard salary and other-source earnings (interest/dividend) with zero detected capital gains or business receipts.';

  const eligibleFactors = compileEligibleFactors(factors);

  if (isBarredFromItr1) {
    recommendedForm = 'ITR-2';
    confidence = 'high';
    headline = 'ITR-2 Mandatory (Statutory Overrides Tracked)';
    summaryReason = routingTriggers[0] || 'Disqualifying investment or statutory criteria detected in AIS.';
  } else {
    confidence = eligibleFactors.length > 0 ? 'high' : 'provisional';
    if (eligibleFactors.length === 0) {
      headline = 'ITR-1 (Sahaj) Provisionally Recommended';
      summaryReason =
        'No disqualifying capital gains or statutory limit violations found in AIS. Verify external criteria below.';
    }
  }

  return {
    targetWorkspace,
    isBarredFromItr1,
    routingTriggers,
    calculatedTotalIncome,
    recommendedForm,
    confidence,
    headline,
    summaryReason,
    disqualifiersFromItr1: routingTriggers,
    eligibleFactors,
    checklist: STANDARD_ITR_CHECKLIST,
    detectedFactors: factors
  };
}
