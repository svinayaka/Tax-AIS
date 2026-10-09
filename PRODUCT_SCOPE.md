# Product Scope — Tax-AIS

> **Indian Income Tax Annual Information Statement (AIS) Extraction Engine & Visual Dashboard**  
> **Status:** Active (Production / Client-Side)  
> **Statutory Version:** Assessment Year 2026-27 (`AY2026-27.1`) under Income-tax Act, 1961  
> **Future Mode:** Form No. 168 under Income-tax Act, 2025 (`FORM_168_FUTURE_MODE`)  
> **Design System:** `@svinayaka/siddi-design-system@1.0.0`

---

## 1. Product Mission & Vision

**Tax-AIS** is a privacy-first, 100% in-browser extraction engine and visual dashboard for Indian Income Tax Annual Information Statement (AIS) and tax statement documents. 

Its mission is to empower individual taxpayers, chartered accountants (CAs), and financial developers to inspect, reconcile, and understand complex CBDT tax ledgers without ever uploading sensitive financial records (PAN, Aadhaar, bank accounts, salary details, or challan histories) to external servers, cloud databases, or third-party AI endpoints.

---

## 2. Target Personas & Core Use Cases

| Persona | Primary Goal | Key In-Scope Value |
| :--- | :--- | :--- |
| **Salaried Individuals** | Reconcile AIS against Form 16 and determine statutory ITR form eligibility. | Immediate client-side extraction, ITR-1 vs ITR-2 qualification checklist, dual-regime tax liability comparison (New vs Old Regime). |
| **Chartered Accountants / Tax Advisors** | Perform rapid pre-filing audit of client AIS records without risking client data leaks. | Offline verification of TDS/TCS ledgers, isolation of inactive/superseded transactions, export to structured CSV / JSON / Markdown. |
| **Retail Investors & Freelancers** | Detect unacknowledged capital gains, dividend withholdings, or SFT high-value signals. | Highlighting SFT transaction codes (e.g., SFT-017, SFT-018), deductor attribution, and securities/investment signals requiring taxpayer verification before statutory ITR routing. |
| **Open Source Developers & Integrators** | Build offline tax calculation or analysis tooling on a typed contract. | Pure TypeScript normalization contract (`AisDeveloperSchema`), Web Worker pipeline, zero-backend static deployment. |

---

## 3. Statutory & Regulatory Boundaries

### 3.1 Primary Statutory Baseline: Income-tax Act, 1961 (AY 2026-27)
- **Active Rule Version:** `AY2026-27.1`
- **Applicable Periods:** Financial Year 2025-26 / Assessment Year 2026-27.
- **Coverage:** Full parsing and normalization of AIS Part A (Assessee Profile) and Part B (B1 TDS/TCS, B2 SFT, B3 Challans, B4 Demand & Refund).
- **ITR-1 Baseline Thresholds (AY 2026-27):**
  - Resident individual (excluding RNOR / Non-Resident).
  - Total income $\le$ ₹50,00,000 (₹50 Lakhs).
  - Accommodation for income from up to **two house properties** (Finance Act amendment).
  - Agricultural income $\le$ ₹5,000.
  - Section 112A LTCG $\le$ ₹1,25,000 (compatible with ITR-1; exceeding ₹1.25L forces ITR-2).
  - Applicable STCG makes the taxpayer ineligible for ITR-1; route to ITR-2 or the applicable higher form based on other income/business conditions.

### 3.2 Future Statutory Mode: Income-tax Act, 2025 / Form No. 168
- **Legal Context:** From 1 April 2026, the Income-tax Act, 2025 replaces the "Assessment Year" concept with a unified "Tax Year" (commencing with Tax Year 2026-27). Form No. 168 serves as the Annual Information Statement under this new framework.
- **Scope Boundary:** 
  - Form No. 168 is explicitly recognized as `form_168_future` using `tax_year`.
  - The engine **strictly avoids fabricating** synthetic `financial_year` or `assessment_year` attributes.
  - Form No. 168 documents are **never silently routed** into ITA 1961 AY 2026-27 rules.
  - An explicit `FORM_168_FUTURE_MODE` statutory warning is emitted, keeping the legacy ITA 1961 extraction payload `null` until native ITA 2025 computation rules are enacted by CBDT.

### 3.3 Form 26AS Boundary
- **Current Status:** Partial / Planned.
- Document classification correctly identifies `FORM_26AS`.
- Full ledger parity is scheduled for subsequent milestones; the engine never assumes or fabricates missing 26AS fields.

---

## 4. Current In-Scope Capabilities

### 4.1 Ingestion & Parsing
- **Supported Formats:** PDF (native vector/text stream), TXT, CSV, and supported JSON.
- **Client-Side Rendering:** Mozilla PDF.js canvas integration with HiDPI Retina scaling, zoom controls, and page navigation.
- **Encrypted PDF Handling:** In-browser decryption dialog supporting CBDT convention (`PAN in UPPERCASE + DOB in DDMMYYYY`) and interactive user entry with zero password logging or caching.

### 4.2 Deterministic Extraction & Section Scoping
- **Part A (Assessee Profile):** Permanent Account Number (PAN), masked Aadhaar, Full Name, Date of Birth (DOB), Mobile, Email, and Registered Address.
- **Part B1 (TDS / TCS):** Deductor grouping, TAN / entity name, quarterly line items, dates, credited sums, tax deducted, tax deposited, and CBDT ledger status (`Active` vs `Inactive`).
- **Part B2 (SFT Transactions):** Specified Financial Transactions with transaction codes, reporting parties, amounts, and transaction dates.
- **Part B3 (Tax Payments / Challans):** Self-assessment and advance tax deposits with Major Head, Minor Head, BSR Code, Challan Serial Number, deposit dates, and challan sums.
- **Part B4 (Demand & Refund):** Status records, assessment years, demand/refund nature, dates, and amounts.
- **Annexure Deduplication:** Strict physical section partitioning isolating Part B1 from subsequent annexure sections (e.g., Part B7 Salary Annexure II) to prevent double-counting.
- **Zero Mock Policy:** Unparsed or absent sections always return clean empty defaults (`''`, `[]`, `0`), never synthetic mock entities.
- **Rules-Driven Recognition:** AIS structural recognition is driven by bundled, versioned machine-readable Part A and Part B rule configurations, while extraction algorithms remain implemented in typed TypeScript.

### 4.3 Two-Tier ITR Classification Pipeline
- **Tier 1 (Automated Web Worker Evaluation):** Deterministic evaluation of AIS transactions for capital gains signals, foreign remittances (LRS), lottery/vda, and high-value cash transactions.
- **Tier 2 (Interactive Checklist):** User-guided checklist inside `<ais-itr-advisor>` for non-AIS statutory conditions (e.g., total income $> ₹50\text{L}$, $> 2$ house properties, unlisted company shares, directorships).

### 4.4 Dual-Regime Tax Computation (Informational Comparison)
- **Decoupled Eligibility:** Calculation is decoupled from form recommendation (`CalculatorEligibility.supported`). If the return has unsupported profiles (e.g., securities activity, business balance sheets, foreign assets), the calculator displays an explicit unsupported notice.
- **New Tax Regime (Section 115BAC):** Standard deduction of ₹75,000; revised AY 2026-27 slab structure; Section 87A rebate up to ₹60,000 for income $\le ₹12\text{L}$; Section 87A marginal relief up to ₹12.75L; surcharge calculation with marginal relief; 4% Health & Education Cess.
- **Old Tax Regime:** Standard deduction of ₹50,000; Chapter VI-A deductions customization (Section 80C, 80D, 80CCD(1B), 80TTA, 24(b)); slab tax with cess.
- **Regime State Machine:** Switching to the New Tax Regime removes or ignores deductions that are legally unavailable under that regime while preserving separately modeled deductions or allowances that remain statutorily permitted. The implementation must not blanket-reset all deduction categories.

### 4.5 User Interface & Design System Standards
- Built entirely on `@svinayaka/siddi-design-system@1.0.0` tokens (`--ksv-ds-*`).
- **Main View vs. Modal Separation:** Core decision and interactive checklist (`<ais-itr-advisor>`) and document viewer reside on the main page; detailed source ledgers (Part A & Part B1-B4) reside inside the AIS Details Modal (`#aisModalBackdrop`).
- **Paired Top Grid:** Primary metric (`Total Amount Credited`) paired with the interactive `Part B Schedules Navigator` featuring direct section deep-linking and highlight.
- **Ledger Status Presentation:** Deductor cards isolate Active vs Inactive/superseded line items to prevent duplicate tax credit claims.

### 4.6 Persistence & Exports
- **Local Session Storage:** 100% client-side IndexedDB (`tax_ais_local_storage`) with a strict 24-hour TTL and manual 'Clear Session' purge.
- **Multi-Format Exporters:**
  - **Developer JSON Schema:** Strict `AisDeveloperSchema` contract.
  - **Filing CSV:** Spreadsheet-ready flattened line items for audit software.
  - **Markdown Report:** Formatted executive summary for tax client sharing.
  - **Print / PDF:** Clean browser print stylesheet.

---

## 5. Explicit Non-Goals & Out-of-Scope Boundaries

To maintain strict data privacy, system reliability, and legal compliance, the following items are **explicitly out of scope**:

| Feature / Area | Scope Status | Rationale |
| :--- | :--- | :--- |
| **Server-Side Document Processing** | **STRICT NON-GOAL** | Violates the core privacy guarantee. No backend API, microservice, or proxy can receive documents. |
| **Remote LLM / Cloud AI Parsing** | **STRICT NON-GOAL** | No taxpayer document text, tokens, or PII may be sent to remote inference APIs (OpenAI, Anthropic, Gemini, etc.). |
| **Direct E-Filing / Portal Submission** | **OUT OF SCOPE** | Tax-AIS is an extraction, reconciliation, and guidance tool, not an authorized e-Return Intermediary (ERI) or automated filing bot. |
| **Official Tax Advice / CA Certification** | **OUT OF SCOPE** | The system provides deterministic statutory guidance and arithmetic comparisons; it does not replace professional tax consultation. |
| **OCR for Scanned / Image-Only PDFs** | **OUT OF SCOPE** | Current architecture processes native PDF text streams via Mozilla PDF.js. Image-only raster scans are unsupported without a dedicated client-side OCR engine. |
| **Complex Business (ITR-3 / ITR-4) Schedules** | **OUT OF SCOPE** | Profit & loss statements, balance sheets, presumptive taxation (§ 44AD/44ADA), and tax audit schedules are outside current scope. |
| **Capital Gains Computation Schedules** | **OUT OF SCOPE** | While the classifier detects capital gains signals, detailed computation of indexed acquisition costs, holding periods, and grandfathering under Section 112A is not modeled by the calculator. |
| **Cloud User Accounts & Sync** | **STRICT NON-GOAL** | No remote user registration, authentication, or multi-device document synchronization. |

---

## 6. Roadmap & Future Scope Horizons

### Milestone 1: Form 16 / AIS Cross-Reconciliation
- Side-by-side ingestion of Employer Form 16 (Part A & Part B).
- Automated line-by-line reconciliation matching TDS-192 entries in AIS with Form 16 Chapter VI-A deductions and gross salary.

### Milestone 2: Native Income-tax Act, 2025 / Form 168 Execution
- Transition from `FORM_168_FUTURE_MODE` detection to active calculation once CBDT officially notifies statutory rules and utilities under the Income-tax Act, 2025.
- First-class support for single `tax_year` evaluation.

### Milestone 3: Full Form 26AS Ledger Parity
- Complete schedule extraction parity for Form 26AS Part I through Part VII.
- Discrepancy report highlighting mismatched TDS between Form 26AS and AIS ledgers.

### Milestone 4: Multi-Year Offline Historical Trends
- Offline comparative analysis of consecutive assessment years (e.g., AY 2024-25 vs AY 2025-26 vs AY 2026-27) stored locally in browser sandbox.

---

## 7. Cross-Reference Documentation

For detailed architectural diagrams, code guidelines, and statutory routing rules, refer to:
- [ARCHITECTURE.md](./ARCHITECTURE.md) — Comprehensive technical architecture, data flows, and security model.
- [AGENTS.md](./AGENTS.md) — Developer & AI agent code quality, SonarQube rules, and styling conventions.
- [ROUTER_AGENT.md](./src/workers/ROUTER_AGENT.md) — Statutory ITR-1 vs ITR-2 classification rules matrix.
- [README.md](./README.md) — Public project overview and quickstart guide.
