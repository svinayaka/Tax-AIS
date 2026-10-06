# Agent System Directive — Statutory ITR Form Classification & Advisory Engine

- **Module:** Statutory ITR Form Classification & Advisory Engine
- **Execution Context:** Background Web Worker (`src/workers/extractor.worker.ts`) through [`src/lib/itr-classifier.ts`](file:///Users/siddhivinayaka/Documents/Learning/ais/src/lib/itr-classifier.ts), with transparent main-thread fallback through [`src/lib/extractor-client.ts`](file:///Users/siddhivinayaka/Documents/Learning/ais/src/lib/extractor-client.ts)
- **UI Presentation:** [`<ais-itr-advisor>`](file:///Users/siddhivinayaka/Documents/Learning/ais/src/components/ais-itr-advisor.ts) mounted on the main results page directly above the document viewer
- **Input Contract:** `AisDeveloperSchema` / validated routing metadata
- **Design System:** `@svinayaka/siddi-design-system@1.0.0`
- **Current Statutory Ruleset:** AY 2026-27 (`ITR_ROUTING_RULE_VERSION = 'AY2026-27.1'`)
- **Execution Model:** 100% client-side / zero server transmission

---

## 1. Purpose

The ITR Router Agent deterministically evaluates the canonical `AisDeveloperSchema` payload together with explicitly user-confirmed statutory checklist answers.
Its responsibility is to recommend the appropriate ITR workspace:
- **ITR-1 (Sahaj)**
- **ITR-2**
- **ITR-3**
- **ITR-4**

The engine is a filing-form guidance layer, not a substitute for the Income Tax Department's filing utility, statutory instructions, or professional tax advice.
The result must remain **provisional** whenever one or more eligibility conditions cannot be established from AIS data alone.

---

## 2. Core Principles

### 2.1 Deterministic Only
The classifier MUST use explicit, auditable rules.
Do not use remote AI / LLM inference, probabilistic classification, guessed taxpayer facts, fabricated mock data, or unrelated AIS values as substitutes for missing statutory facts.

### 2.2 Zero Server Transmission
All routing logic executes locally in the browser.
The classifier MUST NOT call `fetch`, `XMLHttpRequest`, `WebSocket`, remote APIs, analytics containing taxpayer data, or cloud functions.

### 2.3 Missing Data Is Unknown, Not False
A missing property does not prove that the taxpayer satisfies the corresponding eligibility condition.
Use an unresolved state for facts that AIS cannot establish.
Collections may safely default to `[]` when the canonical schema defines them as arrays. Do not default statutory booleans to `false` merely because the canonical AIS schema does not contain them.

### 2.4 Traceability
Every routing decision must be explainable. Confirmed exclusions and routing signals must populate stable machine-readable trigger codes plus user-readable explanations.

### 2.5 Statutory Rules Are Assessment-Year Versioned
Do not hardcode one year's eligibility rules forever. The classifier must use a versioned ruleset selected for the relevant assessment year (`AY2026-27.1`).

---

## 3. AY 2026-27 ITR-1 Baseline

For AY 2026-27, the ITR-1 baseline applies only to an eligible resident individual other than RNOR whose total income does not exceed ₹50 lakh and whose income falls within the categories allowed by the notified ITR-1 rules.

### Important AY 2026-27 rules that MUST be reflected:
- **House Property:** ITR-1 can accommodate income from up to **two house properties** (Finance Act amendment for AY 2026-27). Do NOT use the older rule that "more than one house property" automatically disqualifies ITR-1.
- **Section 112A LTCG:** Long-term capital gain under section 112A up to **₹1.25 lakh** is compatible with ITR-1 (exemption cap revised from ₹1L to ₹1.25L).
- **LTCG Exceeding Limit:** LTCG under section 112A exceeding ₹1.25 lakh is **outside ITR-1** (forces ITR-2).
- **Short-Term Capital Gains:** Short-term capital gains remain strictly **outside ITR-1** (forces ITR-2).
- **Agricultural Income:** Agricultural income above **₹5,000** is outside ITR-1.
- **Total Income:** Total taxable income exceeding **₹50,00,000 (₹50 Lakhs)** is outside ITR-1.

---

## 4. Result Contract

```typescript
export type RecommendedItrForm =
  | 'ITR-1'
  | 'ITR-2'
  | 'ITR-3'
  | 'ITR-4';

export type ClassificationConfidence =
  | 'high'
  | 'provisional';

export interface RoutingTrigger {
  code: string;
  severity: 'info' | 'warning' | 'blocking';
  message: string;
  source:
    | 'PART_A'
    | 'PART_B1'
    | 'PART_B2'
    | 'PART_B3'
    | 'PART_B4'
    | 'CHECKLIST'
    | 'ROUTING_METADATA'
    | 'DERIVED';
}

export interface ItrClassificationResult {
  recommendedForm: RecommendedItrForm;
  targetWorkspace: string;
  confidence: ClassificationConfidence;
  isBarredFromItr1: boolean;
  routingTriggers: RoutingTrigger[];
  eligibleFactors: string[];
  disqualifiersFromItr1: string[];
  unresolvedChecks: string[];
  calculatedTotalIncome?: number;
  checklist: Array<{
    id: string;
    question: string;
    impactIfYes: string;
    isExternalParam: boolean;
  }>;
}
```

`calculatedTotalIncome` must be omitted or marked unresolved when the current payload cannot compute statutory total income reliably.

---

## 5. Initialization

```typescript
const routingTriggers: RoutingTrigger[] = [];
const eligibleFactors: string[] = [];
const disqualifiersFromItr1: string[] = [];
const unresolvedChecks: string[] = [];

let recommendedForm: RecommendedItrForm = 'ITR-1';
let targetWorkspace = 'ITR-1 (Sahaj)';
let isBarredFromItr1 = false;
let confidence: ClassificationConfidence = 'provisional';
```
Use pure helpers instead of duplicating mutations across conditional branches.

---

## 6. Part B1 — TDS / TCS Analysis

```typescript
const b1 = schema.part_b1_tds_tcs_transactions ?? [];
```

### 6.1 Salary Signal
For salary-related TDS such as `TDS-192`, use:
`record.total_amount_credited`
Do not reference a non-existent aggregate amount property on a B1 record.
Salary evidence is an eligible factor, not an ITR-1 exclusion.

### 6.2 Foreign Remittance / LRS TCS
A `206C(1G)` / LRS-related TCS record is a foreign-remittance signal.
It does not by itself prove ownership of a foreign asset, foreign-source income, foreign bank account, foreign signing authority, or mandatory Schedule FA filing.
**Do not automatically force ITR-2 only because LRS-related TCS appears.**
Instead, add a warning trigger and surface foreign-asset / foreign-income questions in the checklist.

### 6.3 Section 194C / 194J
TDS associated with contractual or professional receipts is a business/professional-income signal, not conclusive proof of the final income head.
**Do not automatically route to ITR-3 or ITR-4 from the TDS code alone.**
If business/professional income is confirmed, evaluate ITR-3 vs ITR-4.

### 6.4 Winnings / Online Gaming / VDA Signals
Codes associated with lottery (`194B`), online gaming (`194BA`), or virtual digital assets (`194S`) may indicate income incompatible with the basic ITR-1 workflow.
Classification must use the actual income nature, not the TDS code alone.
For VDA activity, ITR-2 vs ITR-3 depends on whether the activity is treated as investment/capital income or business income.

---

## 7. Part B2 — SFT / Investment Activity

```typescript
const b2 = schema.part_b2_sft_transactions ?? [];
```

### 7.1 SFT Records Are Transaction Signals
An SFT transaction amount is not automatically taxable income, a capital gain, a capital loss, sale consideration attributable to the taxpayer, or proof that a statutory exclusion is satisfied.
**Do not sum SFT values into total taxable income.**

### 7.2 Securities / Mutual Fund Activity
When supported mappings indicate securities activity:
- Record a `CAPITAL_MARKET_ACTIVITY` signal;
- Do not say "capital gain confirmed";
- Determine whether there is short-term capital gain;
- Determine whether section 112A LTCG exists and whether it exceeds ₹1.25 lakh.

**For AY 2026-27:**
- `STCG present` → ITR-1 not allowed (Forces ITR-2)
- `112A LTCG <= ₹1.25 lakh` → May remain compatible with ITR-1
- `112A LTCG > ₹1.25 lakh` → ITR-1 not allowed (Forces ITR-2)
- `Other capital-gain category` → Evaluate under applicable rules

### 7.3 Immovable Property
A property SFT entry or section `194-IA` signal may represent acquisition/purchase activity and does not automatically prove that the taxpayer sold property or realized capital gains.
**Do not force ITR-2 solely because a property transaction signal exists.**

### 7.4 Unlisted Equity
ITR-1 is barred when the taxpayer held unlisted equity shares at any time during the previous year.
Do not infer that fact from an arbitrary SFT code unless the extractor's mapping explicitly establishes unlisted-share holding.
Otherwise ask the user through the external checklist.

---

## 8. Income-Limit Evaluation

ITR-1 requires total income not exceeding ₹50 lakh.
Only run this blocker when statutory total income is reliably available.
**Do not calculate total income as: `salary + allSftAmounts + allCredits`.**
If reliable total income is available and exceeds `5,000,000`, block ITR-1. Otherwise add `TOTAL_INCOME_LIMIT` to `unresolvedChecks` and retain provisional confidence.

---

## 9. External Statutory Checklist

AIS cannot establish every ITR-1 eligibility fact. Therefore, the External Statutory Checklist is **exclusively presented when the assessee is provisionally eligible for ITR-1** to evaluate non-AIS elevation triggers.

**Strict Non-Applicability for ITR-2 Returns:** When AIS data already establishes Form ITR-2 (or higher) due to verified capital gains, high-value securities transactions, foreign remittances, or lottery receipts, the External Statutory Checklist is **strictly omitted/hidden**. External checkboxes cannot downgrade or alter an already established ITR-2 statutory filing requirement.

For AY 2026-27 (when evaluating ITR-1 candidates), the checklist evaluates:
1. Are you RNOR or non-resident for the relevant year?
2. Do you have income from more than two house properties? *(Do NOT ask "more than one house property")*
3. Were you a director in a company during the previous year?
4. Did you hold unlisted equity shares during the previous year?
5. Did you hold any asset or financial interest outside India?
6. Did you have signing authority in an account outside India?
7. Did you have income from a source outside India?
8. Did agricultural income exceed ₹5,000?
9. Do you have brought-forward loss or loss to be carried forward?
10. Was tax deducted under section 194N?
11. Was tax payment/deduction deferred on eligible-start-up ESOP income?
12. Did you have short-term capital gain?
13. Did section 112A LTCG exceed ₹1.25 lakh?
14. Does total income exceed ₹50 lakh?

---

## 10. Interactive Checklist Behavior

1. **When provisionally ITR-1:**
   - Unchecked checkboxes mean only that the user has not declared the condition.
   - If no AIS-based blocker is detected and no checklist blocker is selected:
     **ITR-1 (Sahaj) Provisionally Recommended**
     Supporting copy:
     > *"No ITR-1 exclusion was detected from the available AIS data or your current checklist responses. Review the remaining statutory conditions before filing."*
   - If any checkbox is checked: Dynamically elevates the effective form to **ITR-2 (Elevated by Checklist)** and dispatches `itr-form-changed` to bypass downstream ITR-1 tax calculations.
2. **When already classified as ITR-2 from AIS signals:**
   - The checklist is **strictly omitted / hidden**.
   - The UI presents only the verified statutory disqualifiers extracted directly from AIS data.

---

## 11. ITR-2 Routing

Route to ITR-2 when the taxpayer is not eligible for ITR-1, business/professional income requiring ITR-3/4 is not established, and the applicable statutory rules identify ITR-2 as the correct return.

Examples include:
- Confirmed director status;
- Unlisted equity shareholding;
- Foreign assets, foreign bank accounts, or signing authority;
- Foreign-source income;
- Short-term capital gains;
- Section 112A LTCG exceeding ₹1.25 lakh;
- More than two house properties;
- Agricultural income exceeding ₹5,000;
- Brought-forward / carry-forward losses;
- Section 194N cash withdrawals;
- Deferred ESOP tax;
- Total taxable income exceeding ₹50 lakh.

---

## 12. ITR-3 / ITR-4 Routing

### 12.1 ITR-3
ITR-3 applies when income from profits or gains of business/profession exists and the taxpayer is not eligible for ITR-4.
Do not route to ITR-3 merely because `TDS-194C` or `TDS-194J` appears in Part B1.

### 12.2 ITR-4
ITR-4 requires explicit presumptive-business/profession eligibility under applicable statutory provisions (Sections 44AD, 44ADA, 44AE).
Do not infer presumptive eligibility from AIS alone.
Until validated business/profession, presumptive section, residency, turnover/receipt limits, and exclusions are available, return an unresolved business-routing check rather than guessing between ITR-3 and ITR-4.

---

## 13. UI Layout & Separation of Concerns

- **Main Results Page:**
  - `<ais-itr-advisor>` is mounted directly on the main page above the PDF document viewer.
  - Displays:
    1. Recommended ITR form;
    2. Provisional / High-confidence badge;
    3. AIS-derived routing reasons and triggers;
    4. External statutory checklist with interactive checkboxes;
    5. Live reclassification when checklist answers change;
    6. Unresolved checks requiring confirmation.
- **Dedicated AIS Details Modal Window (`#aisModalBackdrop`):**
  - Houses **ONLY** the raw extracted source document ledgers: Part A (Assessee Profile) and Part B (B1 Deductors, B2 SFT, B3 Challans, B4 Demand & Refund).

---

## 14. Downstream ITR-1 Tax Calculation & Dual-Regime Comparison (New vs. Old)

> [!IMPORTANT]
> **GATEKEEPER CONDITION:**
> The tax calculation engine runs **ONLY when the taxpayer falls under the ITR-1 category** (or provisional ITR-1) **AND has a supported calculation profile** (`CalculatorEligibility.supported === true`).
> Form classification and tax calculation are distinct evaluation stages. An ITR-1-compatible return with non-zero Section 112A capital gains is valid for ITR-1 filing, but unsupported by the current tax calculator (which does not model capital gains schedules).
> If the taxpayer is classified under **ITR-2** (or ITR-3/4), or has an unsupported calculator profile, calculation is bypassed with an explicit notice card.

```text
               ITR Form Classification Completed
                               │
                Is recommendedForm === 'ITR-1'?
                               │
              ┌────────────────┴────────────────┐
              │ YES                             │ NO (ITR-2 / 3 / 4)
              ▼                                 ▼
   ITR-1 Tax Calculation Engine        Bypass Calculation
   1. Decompose Salary vs Non-Salary   Display: "ITR-2 requires full Schedule
   2. Compute New Regime Tax (AY 26-27) CG/FA computation outside ITR-1"
   3. Compute Old Regime Tax (AY 26-27)
   4. Deduct Pre-Paid TDS & Challans
   5. Determine Tax Payable vs Refund
   6. Display Regime Comparison & Estimated Difference
```

### 14.1 Income Decomposition from AIS (ITR-1 Category)
The calculator extracts and decomposes income strictly from canonical AIS sources:
1. **Salary Income (`TDS-192`):** Sum of gross `total_amount_credited` from all deductors with information code `TDS-192`.
2. **Non-Salary Incomes:**
   - **Interest from Bank Deposits / Savings (`TDS-194A`):** Sum of credited amounts.
   - **Dividends from Equities / Mutual Funds (`TDS-194K`):** Sum of credited amounts.
   - **Other Income:** Any other compliant non-business/non-capital gain credits.
3. **Gross Total Income (GTI):**
   $$\text{Gross Total Income} = \text{Salary Income} + \text{Non-Salary Incomes}$$

### 14.2 Pre-Paid Taxes & Tax Credits
1. **TDS Deposited:** Sum of all `tds_deposited` (or `tds_deducted`) across all deductors in `part_b1_tds_tcs_transactions`.
2. **Advance & Self-Assessment Tax Paid:** Sum of all `tax_amount` in `part_b3_tax_payments` (Challans).
3. **Total Tax Credits Available:**
   $$\text{Total Tax Credit} = \text{Total TDS Deposited} + \text{Total Challan Payments}$$

### 14.3 Dual-Regime Tax Computation (AY 2026-27 Rules)

#### A. New Tax Regime (Section 115BAC — Default for AY 2026-27)
1. **Standard Deduction:** ₹75,000 for salaried individuals (increased under Finance Act 2024 / AY 2026-27).
2. **Net Taxable Income:**
   $$\text{Net Taxable Income}_{\text{New}} = \max(0, \text{Salary Income} - 75000) + \text{Non-Salary Incomes}$$
3. **Tax Slab Rates (AY 2026-27):**
   - Up to ₹4,00,000: **Nil (0%)**
   - ₹4,00,001 to ₹8,00,000: **5%**
   - ₹8,00,001 to ₹12,00,000: **10%**
   - ₹12,00,001 to ₹16,00,000: **15%**
   - ₹16,00,001 to ₹20,00,000: **20%**
   - ₹20,00,001 to ₹24,00,000: **25%**
   - Above ₹24,00,000: **30%**
4. **Section 87A Rebate:** Up to ₹60,000 where applicable for eligible total income up to ₹12,00,000. The calculator does not assume that special-rate income qualifies for rebate treatment.
5. **Section 87A Marginal Relief:** For eligible total income marginally exceeding ₹12,00,000 up to ₹12,75,000, where tax exceeds the excess income over ₹12,00,000.
6. **Surcharge & Surcharge Marginal Relief:** At thresholds ₹50L, ₹1Cr, ₹2Cr (New Regime maximum surcharge rate capped at 25%).
7. **Health & Education Cess:** 4% on tax base (income tax plus applicable surcharge after marginal relief).
8. **Statutory Deduction Constraints:** Under Section 115BAC, deductions under Chapter VI-A (Section 80C, 80D, 80CCD(1B), 80TTA) are generally unavailable. Section 24(b) interest on self-occupied properties is disallowed; let-out property interest can be deducted against rental income subject to loss set-off rules. Employer NPS u/s 80CCD(2) remains separately eligible subject to statutory conditions.
9. **UI State & Deduction Nullification:** When the New Tax Regime is selected or active, the Chapter VI-A deduction editor is strictly **hidden/collapsed**, and any previously entered deduction values are automatically **nullified to zero** (`{ ...DEFAULT_DEDUCTIONS }`) to prevent any erroneous assumption that deductions reduce New Regime tax liability.

#### B. Old Tax Regime (Optional)
1. **Standard Deduction:** ₹50,000 for salaried individuals.
2. **Eligible Deductions Available (Estimated from AIS or standard declarations):**
   - Section 80C (EPF/PPF/ELSS/Life Insurance): Up to ₹1,50,000.
   - Section 80D (Health Insurance): Up to ₹25,000 (Self/Family) + ₹50,000 (Senior Citizen Parents).
   - Section 80CCD(1B) (NPS Tier 1): Up to ₹50,000.
   - Section 80TTA (Savings Bank Interest): Up to ₹10,000 (₹50,000 u/s 80TTB for seniors).
   - Section 24(b) (Home Loan Interest on self-occupied house): Up to ₹2,00,000.
3. **Net Taxable Income:**
   $$\text{Net Taxable Income}_{\text{Old}} = \max(0, \text{Salary Income} - 50000 - \text{Total Deductions}) + \text{Non-Salary Incomes}$$
4. **Tax Slab Rates (Old Regime):**
   - Up to ₹2,50,000: **Nil (0%)**
   - ₹2,50,001 to ₹5,00,000: **5%**
   - ₹5,00,001 to ₹10,00,000: **20%**
   - Above ₹10,00,000: **30%**
5. **Section 87A Rebate:** If net taxable income $\le ₹5,00,000$, full tax rebate up to ₹12,500 applies (effective tax liability is **₹0**).
6. **Health & Education Cess:** 4% on net tax.

### 14.4 Determination of Tax Payable vs. Tax Refund
For the chosen regime:
$$\text{Net Tax Position} = \text{Total Tax Liability} - \text{Total Tax Credit}$$

- If $\text{Net Tax Position} > 0$: **Tax Payable** (Taxpayer must pay self-assessment tax via challan before filing).
- If $\text{Net Tax Position} < 0$: **Tax Refund Claimable** (Taxpayer is entitled to claim an income tax refund of $|\text{Net Tax Position}|$).
- If $\text{Net Tax Position} = 0$: **Nil Balance** (Taxes fully satisfied).

### 14.5 Regime Comparison & Estimated Tax Difference
1. **Recommended Regime Identification:**
   $$\text{Recommended Regime} = \begin{cases} \text{New Tax Regime}, & \text{if } \text{Tax}_{\text{New}} \le \text{Tax}_{\text{Old}} \\ \text{Old Tax Regime}, & \text{if } \text{Tax}_{\text{Old}} < \text{Tax}_{\text{New}} \end{cases}$$
2. **Estimated Tax Difference:**
   $$\text{Estimated Tax Difference} = |\text{Tax}_{\text{Old}} - \text{Tax}_{\text{New}}|$$
3. **Informational Guidance:**
   - **When New Regime Wins:** Highlight the simplicity, absence of investment lock-in requirements, higher rebate threshold (₹12L taxable income / ₹12.75L gross salary with ₹75k standard deduction), and ₹75k standard deduction.
   - **Breakeven Threshold Analysis:** Calculate the additional deductions (u/s 80C, 80D, 80CCD(1B), 24b) required for the Old Regime to become more beneficial than the New Regime.
   - **Informational Considerations:**
     - *NPS 80CCD(1B):* Up to ₹50,000 exclusively over and above Section 80C (Old Regime).
     - *Health Insurance 80D:* Up to ₹25,000 for family + ₹50,000 for senior parents (Old Regime).
     - *Interest Deductions 80TTA/80TTB:* Savings bank interest deduction (Old Regime).
     - *House Loan Interest 24(b):* Up to ₹2,00,000 for self-occupied home loan interest (Old Regime).
4. **Interactive Deduction Customization State Machine:**
   - **Old Regime Chosen:** The taxpayer can toggle the Chapter VI-A deduction editor to customize investments (80C, 80D, 80CCD(1B), 24b) and view real-time tax differences. A *Reset to ₹0* action is provided for quick clearing.
   - **New Regime Chosen:** The deduction editor is automatically hidden/collapsed, previous entered deduction values are strictly nullified back to zero, and an informative badge (`Chapter VI-A Deductions Not Applicable (Sec 115BAC)`) replaces the customization button.

---

## 15. UI Presentation & Layout Placement

The complete workflow is organized sequentially on the **main results page**, directly above the PDF Document Viewer:

```text
               ┌──────────────────────────────────────────────────┐
               │ 1. Header Banner & "Show AIS (Part A & B)" Modal  │
               └─────────────────────────┬────────────────────────┘
                                         │
                                         ▼
               ┌──────────────────────────────────────────────────┐
               │ 2. KPI Metrics Grid (TDS Sources, Credits, Paid) │
               └─────────────────────────┬────────────────────────┘
                                         │
                                         ▼
               ┌──────────────────────────────────────────────────┐
               │ 3. Statutory ITR Form Guidance (<ais-itr-advisor>)│
               │    - Recommendation Badge (ITR-1 vs ITR-2)       │
               │    - CBDT Factor Explanations & Triggers         │
               │    - Interactive Statutory Checklist (Checkboxes) │
               └─────────────────────────┬────────────────────────┘
                                         │
                             Is Form ITR-1?
                                         │
                        ┌────────────────┴────────────────┐
                        │ YES                             │ NO
                        ▼                                 ▼
         ┌──────────────────────────────┐  ┌──────────────────────────────┐
         │ 4. Tax Regime Calculator     │  │ 4. ITR-2 Notice Card         │
         │    (ITR-1 Category Only)     │  │    "Tax calculation deferred:│
         │    - Salary vs Non-Salary    │  │    Capital gains / foreign   │
         │    - Old vs New Comparison   │  │    schedules require ITR-2"  │
         │    - Tax Payable / Refund    │  └──────────────┬───────────────┘
         │    - Best Regime + Savings   │                 │
         │    - Tax Saving Suggestions  │                 │
         └──────────────┬───────────────┘                 │
                        │                                 │
                        └────────────────┬────────────────┘
                                         │
                                         ▼
               ┌──────────────────────────────────────────────────┐
               │ 5. High-DPI Retina PDF Canvas & Text Stream View │
               └──────────────────────────────────────────────────┘
```

The dedicated modal window ([`#aisModalBackdrop`](file:///Users/siddhivinayaka/Documents/Learning/ais/index.html#L280)) remains responsible strictly for raw extracted source tables (**Part A and Part B only**).

---

## 16. Stable Trigger Codes

```typescript
export const ItrRoutingTriggerCode = {
  TOTAL_INCOME_OVER_50L: 'TOTAL_INCOME_OVER_50L',
  NON_RESIDENT_OR_RNOR: 'NON_RESIDENT_OR_RNOR',
  MORE_THAN_TWO_HOUSE_PROPERTIES: 'MORE_THAN_TWO_HOUSE_PROPERTIES',
  COMPANY_DIRECTOR: 'COMPANY_DIRECTOR',
  UNLISTED_EQUITY: 'UNLISTED_EQUITY',
  FOREIGN_ASSET: 'FOREIGN_ASSET',
  FOREIGN_SIGNING_AUTHORITY: 'FOREIGN_SIGNING_AUTHORITY',
  FOREIGN_SOURCE_INCOME: 'FOREIGN_SOURCE_INCOME',
  AGRICULTURAL_INCOME_OVER_5000: 'AGRICULTURAL_INCOME_OVER_5000',
  BROUGHT_FORWARD_LOSS: 'BROUGHT_FORWARD_LOSS',
  TDS_194N: 'TDS_194N',
  DEFERRED_ESOP_TAX: 'DEFERRED_ESOP_TAX',
  SHORT_TERM_CAPITAL_GAIN: 'SHORT_TERM_CAPITAL_GAIN',
  SECTION_112A_LTCG_OVER_LIMIT: 'SECTION_112A_LTCG_OVER_LIMIT',
  BUSINESS_INCOME_SIGNAL: 'BUSINESS_INCOME_SIGNAL',
  FOREIGN_REMITTANCE_SIGNAL: 'FOREIGN_REMITTANCE_SIGNAL',
  CAPITAL_MARKET_ACTIVITY: 'CAPITAL_MARKET_ACTIVITY',
} as const;
```

---

## 17. Assessment-Year Rule Versioning

Expose a rule version:
```typescript
export const ITR_ROUTING_RULE_VERSION = 'AY2026-27.1';
```

Architecture pattern:
```typescript
const rules = getItrRoutingRules(assessmentYear);
```
If the requested assessment year has no implemented ruleset, do not silently reuse AY 2026-27 rules; surface an explicit unsupported assessment year status.

---

## 18. Code Quality & Safety

The classifier must:
- Use TypeScript strict mode;
- Avoid `any`;
- Avoid nested ternaries;
- Keep SonarJS cognitive complexity $\le 15$;
- Use pure helper functions where practical;
- Not mutate incoming `AisDeveloperSchema`;
- Avoid unsafe regular expressions (no character-class duplicates, ReDoS safe);
- Use zero mock taxpayer fallbacks;
- Never log sensitive taxpayer values (PAN, Aadhaar, salary totals, bank details);
- Keep Web Worker messages structured-clone compatible.

Before committing:
```bash
npm run sonar:check
npm run build
```
Both commands must pass with **zero errors**.

---

## 19. Mandatory Instructions for AI Coding Agents

Any agent modifying ITR routing MUST:
1. Use the assessment-year-specific rule set (`AY2026-27.1`);
2. Preserve 100% local in-browser execution;
3. Use canonical schema fields exactly (`record.total_amount_credited`);
4. Treat AIS codes as evidence/signals only when their semantic mapping is defined;
5. Never equate an SFT transaction amount with taxable income;
6. Never infer foreign assets merely from LRS/TCS activity;
7. Never infer business income solely from a TDS section code;
8. Distinguish confirmed blockers from unresolved checks;
9. Keep ITR-form routing separate from tax-regime calculation;
10. Trigger the income tax calculator **ONLY when the taxpayer is categorized under ITR-1 AND has a supported calculator profile** (`CalculatorEligibility.supported === true`);
11. Keep checklist questions synchronized with AY 2026-27 official ITR eligibility rules (up to two house properties allowed);
12. Preserve traceability through stable trigger codes;
13. Update tests whenever statutory thresholds or form eligibility rules change.
