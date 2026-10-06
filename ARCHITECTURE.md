System Architecture — Tax-AIS
- System: Indian Income Tax Annual Information Statement (AIS) Extraction Engine & Visual Dashboard
- Repository: https://github.com/svinayaka/Tax-AIS.git
- Design System: @svinayaka/siddi-design-system@1.0.0
- Execution Paradigm: 100% Client-Side / Zero Server Transmission
- Language / Stack: TypeScript (Strict), Web Components (Stencil-like conventions), Vite, Mozilla PDF.js
1. System Overview
Tax-AIS is a privacy-first, browser-only extraction and visualization application for Indian Income Tax documents, primarily the Annual Information Statement (AIS).
The system converts supported source files into a canonical typed data model, renders that model through reusable Web Components, and exports normalized data without transmitting taxpayer information to any remote service.
Current Scope
- Annual Information Statement (AIS): Fully supported within the fields implemented by the current extractor and schema for Assessment Year 2026-27 (Financial Year 2025-26) under the Income-tax Act, 1961.
- Form 26AS: Partial/planned. Do not assume Form 26AS fields exist unless explicitly implemented in the extractor, types, UI, and exporters.
- Supported Ingestion Formats: PDF, TXT, CSV, and supported JSON.
- Processing Location: Browser only (100% client-side execution).
Income-tax Act Transition Boundary
The currently implemented ITR-classification and tax-calculation rules in Tax-AIS are versioned for Assessment Year 2026-27 under the Income-tax Act, 1961, corresponding to income earned during Financial Year 2025-26.
From 1 April 2026, the Income-tax Act, 2025 introduces the concept of Tax Year and discontinues the Assessment Year concept for Tax Year 2026-27 onwards.
Form No. 168 under the Income-tax Rules, 2026 is the Annual Information Statement for the new Tax-Year framework under the Income-tax Act, 2025 and uses Tax Year rather than Assessment Year.
Statutory Mode Resolution: Form No. 168 represents a separate future statutory mode under the Income-tax Act, 2025. It uses tax_year and does NOT fabricate an assessment_year or financial_year. The current extraction engine does not silently route Form 168 documents through AY 2026-27 / Income-tax Act, 1961 rules; instead, it classifies the document as form_168_future, emits an explicit FORM_168_FUTURE_MODE statutory warning, and keeps the canonical ITA 1961 extraction envelope null until native ITA 2025 rules are enabled.
2. Architectural Principles
1. Privacy First: Sensitive taxpayer data remains strictly on the user's local device.
2. Deterministic Extraction: Prefer rule-based, spatial, and schema-driven extraction over opaque remote inference.
3. Typed Canonical Model: All supported extraction paths normalize into a stable TypeScript contract (AisDeveloperSchema).
4. Separation of Concerns: Input parsing, normalization, extraction, persistence, UI, and export remain modular.
5. No Mock Data Fallbacks: Missing or unparsed sections never produce synthetic names, deductors, challans, or transaction records. Always return clean empty defaults ('', [], 0).
6. Explicit Failure Semantics: "No data present" and "failed to parse" must not be treated as the same state internally.
7. Design-System Compliance: Themeable UI behavior must strictly use @svinayaka/siddi-design-system tokens (--ksv-ds-*).
8. Static Deployment: The production application has no application backend or server-side taxpayer processing; hosting infrastructure serves static application assets only.
3. Scope & Non-Goals
In Scope
- Annual Information Statement (AIS) PDF reconstruction and extraction
- Part A assessee information (PAN, masked Aadhaar, Name, DOB, Mobile, Email, Address)
- Part B1 TDS/TCS transactions & quarterly line items
- Part B2 SFT (Specified Financial Transactions)
- Part B3 Tax payments / challan deposits
- Part B4 Demand and refund records
- TXT / CSV / supported JSON ingestion
- Local session restoration (IndexedDB with 24-hour TTL)
- JSON / CSV / Markdown / print export
- Light and dark theme support (high-contrast, accessible)
- Static browser deployment (Netlify SPA)
Explicit Non-Goals
The current architecture intentionally does not provide:
- Server-side taxpayer-document processing;
- Remote LLM parsing of taxpayer documents or extracted text;
- Cloud persistence or remote synchronization of taxpayer records;
- Remote telemetry containing document contents or extracted tax information;
- Tax filing or statutory return submission to the Income Tax Department;
- Personalized legal, accounting, or professional tax advice;
- Tax calculations outside explicitly implemented and versioned assessment-year rule sets;
- Complete Form 26AS support until explicitly implemented;
- Form No. 168 / Income-tax Act, 2025 documents operate in a separate future statutory mode (using tax_year without fabricating FY/AY) and are not silently routed through AY 2026-27 / ITA 1961 extraction logic; full native Tax-Year rule engines are reserved for future standalone statutory rule sets;
- OCR for image-only/scanned documents unless introduced through a separate architectural decision.
[!IMPORTANT]

Any future feature that transmits document-derived content externally requires a separate architecture decision, privacy review, user consent model, and an explicit update to the Zero Server Transmission guarantee.

4. Privacy Model & Trust Boundaries
Privacy & Security Guarantees
- Zero Server Transmission: PDF parsing, text reconstruction, extraction, normalization, visualization, persistence, and export execute locally in the browser.
- No Remote Telemetry or Storage: Document buffers, parsed tax objects, normalized output, PAN, Aadhaar, names, addresses, bank information, challan details, and passwords must never be sent to analytics, error trackers, APIs, or cloud storage.
- No Sensitive Logging: Sensitive taxpayer data must not be written to console.*, telemetry, diagnostics, or error-reporting payloads.
- Client-Side Password Unlocking: Encrypted PDFs are unlocked locally through Mozilla PDF.js password callbacks. The application may support known AIS password conventions, including PAN in uppercase combined with DOB in DDMMYYYY format where applicable, but must not assume every encrypted tax document uses that convention. The user can provide the password interactively when convention-based unlocking is not applicable. Password values are never persisted, cached, transmitted, or logged.
- Local PDF.js Worker: The PDF.js worker is bundled and served locally from the application bundle.
- Content Security: Do not use eval, new Function, remote script loading, or similar mechanisms that execute untrusted code. Production deployment requires an appropriate Content Security Policy compatible with the locally bundled Vite/PDF.js worker architecture and no-remote-script model. Taxpayer-controlled and document-derived strings must be rendered using safe DOM APIs such as textContent or equivalent escaping/sanitization; untrusted document-derived content must never be inserted through unsanitized innerHTML.
- Static Hosting Boundary: Netlify hosts static application assets only. It must not receive taxpayer documents or extraction payloads.
Trust Boundaries
Trusted Application Code
- Bundled first-party TypeScript application source;
- Locally bundled Mozilla PDF.js worker;
- @svinayaka/siddi-design-system;
- Vite-generated static assets;
- Locally shipped application configuration.
Untrusted Inputs
- Uploaded PDF binary streams and file contents;
- PDF metadata;
- TXT / CSV / JSON file contents;
- File names;
- Encrypted PDF password inputs;
- Imported schema versions;
- User-pasted data.
All imported content must be treated strictly as data, never executable content.
5. High-Level Data Flow

PDF / TXT / CSV / Supported JSON

              │

              ▼

      Input Format Adapter

              │

              ▼

      Normalization Layer

              │

              ▼

   ┌───────────────────────────────────────────────┐

   │ Background Web Worker (extractor.worker.ts)   │

   │                                               │

   │  1. Deterministic Extraction (Part A, B1–B4)  │

   │  2. Schema Validation (AisDeveloperSchema)    │

   │  3. Statutory ITR Classifier (ITR-1 vs 2/3/4) │

   └───────────────────────────────────────────────┘

              │ (postMessage / transparent fallback)

              ▼

      Main Thread Orchestrator

         ┌────────────┬─────────────────────────┐

         ▼            ▼                         ▼

   Main Page UI   AIS Details Modal         Exporter

   - <ais-itr-    (Part A & Part B Only:    (JSON / CSV / MD)

     advisor>      Part A, B1, B2, B3, B4)

   - ITR-1 Tax        ▲

     Calculator       │ Triggers: Side Button,

     (Old vs New)     │ Viewer Toolbar, Part B Nav

   - PDF Viewer       │

   - Paired KPIs      │

         ┌────────────┴─────────────────────────┐

         ▼

   Local Persistence (IndexedDB 24h TTL: Schema + ITR)

Canonical Rule:

Input Format  ≠  Extraction Logic  ≠  Canonical Schema

Each input format has its own adapter. Supported content is normalized before it reaches the canonical extraction and validation layers.
6. Supported Input Matrix
| Input | Support | Parsing Strategy | Network |
| :--- | :--- | :--- | :--- |
| AIS PDF | Full | PDF.js + spatial reconstruction + deterministic extractor | Never (Local) |
| AIS TXT | Supported | Text adapter + deterministic extractor | Never (Local) |
| CSV | Supported | Structured adapter + normalization | Never (Local) |
| Tax-AIS JSON | Supported | Schema detection + validation + normalization | Never (Local) |
| Form 26AS PDF | Partial / Planned | Only explicitly implemented sections | Never (Local) |
| Unknown JSON | Unsupported | Reject or surface validation error | Never (Local) |
| Image-only scanned PDF | Unsupported | No silent fallback (requires future OCR) | Never (Local) |
7. Component & Directory Structure

Tax-AIS/

├── .husky/                     # Git pre-commit hooks (SonarQube, Stylelint, TypeScript)

├── public/                     # Static assets & routing

│   ├── _redirects              # Netlify SPA fallback routing

│   ├── favicon.svg             # Application favicon

│   └── icons.svg               # SVG icon sprites

├── src/
│   ├── components/             # Custom Elements (Stencil-like conventions)
│   │   ├── ais-deductor-card.ts    # TDS/TCS deductor entity & quarterly line items
│   │   ├── ais-itr-advisor.ts      # Statutory ITR form guidance & criteria checklist
│   │   ├── ais-kpi-card.ts         # Metric KPI card components
│   │   ├── ais-part-a.ts           # Assessee Profile & identity breakdown
│   │   ├── ais-tax-calculator.ts   # Dual-regime comparison, deduction editor & tax breakdown
│   │   ├── ais-tax-payment-card.ts # Part B3 Challan / BSR payment records
│   │   └── index.ts                # Component registry & customElements.define guards
│   ├── lib/                    # Core engines & utilities
│   │   ├── ais-rule-loader.ts      # Bundled rule loader, validation & version provider
│   │   ├── ais-section-detector.ts # Physical Part A & Part Bn section boundary detector
│   │   ├── dom-utils.ts            # Sanitization, escaping, and INR currency formatting
│   │   ├── exporter.ts             # Multi-format exporter (JSON, CSV, Markdown)
│   │   ├── extractor-client.ts     # Web Worker dispatcher & resilient main-thread fallback
│   │   ├── extractor.ts            # Spatial & deterministic regex extraction engine
│   │   ├── itr-classifier.ts       # Statutory ITR-1 vs ITR-2/3/4 classification rules
│   │   ├── pdf-parser.ts           # Mozilla PDF.js spatial coordinate reconstructor
│   │   ├── storage.ts              # IndexedDB persistence with 24h TTL
│   │   └── tax-calculator.ts       # AY-versioned tax regime comparison & slab computation
│   ├── rules/                  # Declarative AIS structural rules & parser routing
│   │   ├── ais-part-a.json         # Part A metadata, boundary markers, and canonical field aliases
│   │   └── ais-part-b.json         # Part B discovery patterns, parser routing & unknown section policies
│   ├── workers/                # Background Web Workers (reduces main-thread processing)
│   │   ├── extractor.worker.ts     # Off-thread extraction and ITR form classifier
│   │   └── ROUTER_AGENT.md         # Statutory routing directives & classification matrix
│   ├── types/
│   │   ├── ais-rules.ts            # Strict TypeScript contracts for AIS declarative rules
│   │   └── ais.ts                  # Canonical TypeScript contracts & schema interfaces
│   ├── main.ts                 # Orchestrator, theme manager, file ingestion, storage init
│   └── style.scss              # Styling & tokens (@svinayaka/siddi-design-system)

├── tests/                      # Automated test suite & statutory fixtures
│   ├── fixtures/               # Statutory PDF documents & expected JSON contracts
│   │   └── ais/
│   │       ├── itr1/           # ITR-1 baseline PDF & expected extraction
│   │       │   ├── ais-itr1-basic.pdf
│   │       │   └── expected.json
│   │       └── itr2/           # ITR-2 capital gain signal PDF & expected extraction
│   │           ├── ais-itr2-capital-gain-signal.pdf
│   │           └── expected.json
│   ├── extractor/              # Deterministic rule & extractor unit specifications
│   │   └── ais-extractor.spec.ts
│   └── integration/            # End-to-end PDF extraction & ITR classification tests
│       └── ais-classification.spec.ts

├── eslint.config.js            # ESLint flat config with TypeScript + SonarJS
├── .lintstagedrc.json          # Staged-file pre-commit lint configuration
├── .npmrc                      # GitHub Packages scoped registry auth configuration
├── stylelint.config.js         # Stylelint configuration extending standard CSS rules
├── AGENTS.md                   # Developer & AI Agent contribution guidelines
├── ARCHITECTURE.md             # System architecture documentation
├── index.html                  # Single-page application shell
├── netlify.toml                # Netlify build, SPA routing & security headers
├── package.json                # Project dependencies, scripts, and quality gates
├── sonar-project.properties    # SonarQube / SonarCloud configuration
└── tsconfig.json               # Strict TypeScript compiler configuration

If the repository structure changes, this tree and [`AGENTS.md`](./AGENTS.md) must be updated together.
8. Input Adapter Architecture
8.1 PDF Input Adapter
Responsible for binary stream decoding, encrypted-document password callbacks, PDF.js page iteration, text-item extraction with bounding boxes, spatial coordinates, line reconstruction, HiDPI Retina canvas rendering, and handoff to the normalization layer.
8.2 Text Input Adapter
Handles plain text and pipe-delimited content, normalizes line endings (\r\n to \n), cleans up trailing whitespace, and routes tokens to the deterministic extractor.
8.3 CSV Input Adapter
Handles delimiter parsing, quoted row normalization, header detection, numeric stripping/normalization, and supported column mapping.
8.4 JSON Input Adapter
The JSON path must:
1. Parse syntactically valid JSON;
2. Detect whether the payload matches a supported schema version;
3. Validate required structural contracts;
4. Normalize external field names into Tax-AIS canonical fields;
5. Reject unsupported or ambiguous schemas with actionable warnings.
An externally supplied JSON file must never be assumed to already match AisDeveloperSchema.
9. PDF Reconstruction (src/lib/pdf-parser.ts)
Standard PDF text extraction frequently loses spatial structure, particularly in multi-column tables and multi-line cells. pdf-parser.ts performs robust spatial reconstruction:
Core Responsibilities
1. Affine Transform Translation: Maps PDF viewport coordinates $(x, y)$ into application coordinate space while accounting for device pixel ratio and HiDPI rendering.
2. Dynamic Line Grouping: Groups raw text tokens vertically using a proximity tolerance ($\Delta y \le 5\text{px}$).
3. Horizontal Spacing Reconstruction: Uses horizontal gaps $\Delta x$ between adjacent text tokens to preserve whitespace delimiters and tabular column boundaries without accidental character fusion.
4. Password Callback Handling: Solicits encrypted-document passwords in memory via PDF.js callbacks without storing, caching, transmitting, or logging them; supports known conventions (such as uppercase PAN + DDMMYYYY DOB) where applicable with interactive user fallback when convention-based unlocking is not applicable.
5. HiDPI Rendering: Scales canvas rasterization for high-density Retina displays.

export interface TextItem {

  str: string;

  dir: string;

  width: number;

  height: number;

  transform: number[];

  x: number;

  y: number;

  fontSize: number;

  fontName?: string;

  hasEOL?: boolean;

}

Implementation-specific thresholds may evolve. The architecture requires stable spatial reconstruction behavior, not a permanently fixed numeric threshold.

10. AIS Rule Configuration Layer

The AIS Rule Configuration Layer introduces a machine-readable rule architecture separating document-structure declarations and parser routing from low-level parsing algorithms.

Architectural Hierarchy & Flow:

ARCHITECTURE.md
    ↓
bundled AIS rule JSON (src/rules/ais-part-a.json, src/rules/ais-part-b.json)
    ↓
typed rule loader (src/lib/ais-rule-loader.ts)
    ↓
section detector (src/lib/ais-section-detector.ts)
    ↓
parser registry (AIS_PARSER_REGISTRY in src/lib/extractor.ts)
    ↓
extractor (src/lib/extractor.ts)
    ↓
canonical AisDeveloperSchema (src/types/ais.ts)

Architectural Division of Responsibilities:
1. ARCHITECTURE.md defines architectural contracts, trust boundaries, statutory invariants, and security constraints.
2. Rule JSON (src/rules/ais-part-a.json, src/rules/ais-part-b.json) defines machine-readable AIS document structure, labels, aliases, section start/end markers, parser-routing metadata, deductor isolation rules, and supported/unsupported policies.
3. TypeScript implements concrete parsing algorithms, spatial extraction routines, and regex tokenization engines.
4. src/types/ais.ts defines canonical extracted-data contracts (AisDeveloperSchema, StructuredExtractionResult).
5. Zero Executable Code in Rules: Rule JSON must never contain executable JavaScript, scripts, or function definitions.
6. Static Parser Registry: Dynamic execution (eval, new Function, or dynamic execution of parser names) is strictly prohibited. The rule JSON references only closed, strongly typed parser IDs ('partA' | 'partB1' | 'partB2' | 'partB3' | 'partB4') mapped to static TypeScript functions via AIS_PARSER_REGISTRY.
7. Safe Rule Loading (src/lib/ais-rule-loader.ts):
   - Synchronously loads and validates bundled rule files at application startup;
   - Fails safely with explicit application errors on malformed rule configuration;
   - Never falls back to fabricated defaults;
   - Never fetches rules remotely (100% in-browser guarantee);
   - Never logs taxpayer data.
8. Physical Section Boundary Detection (src/lib/ais-section-detector.ts):
   - Scans document text for Part A start/end markers;
   - Discovers all numbered Part Bn sections matching the rule pattern equivalent to Part B([0-9]+);
   - Distinguishes known + supported sections (B1, B2, B3, B4), known + unsupported sections, and unknown sections (e.g. Part B7);
   - Preserves unknown or annexure sections as structural metadata with status 'unsupported' (unknownSectionPolicy: 'preserve-as-unsupported');
   - Prevents unrouted sections from ever contaminating B1–B4 parsers.

11. Extraction & Normalization (src/lib/extractor.ts)
10.1 Document Classification
Supported document classes remain intentionally narrow:
- AIS
- FORM_26AS
- UNKNOWN
10.2 Entity Extraction
Identifier and field extraction must use bounded, deterministic rules appropriate to supported source formats. Architecture requires:
- Boundary-safe matching (e.g. /\b[a-z]{5}\d{4}[a-z]\b/i);
- Case-insensitive identifier handling where applicable without character class duplicates;
- No catastrophic regex backtracking (ReDoS prevention);
- No synthetic or fabricated values.
10.3 Part A — Assessee Profile
Extracts supported legal name, PAN, masked Aadhaar, date of birth, mobile number, email address, and multi-line residential address.
10.4 Part B1 — TDS/TCS Transactions
Resolves deductor entities and quarterly line items using a robust, section-scoped and block-partitioned pipeline:
1. Physical Section Scoping (extractPartB1Section): Isolates the document text strictly between Part B1 - Information relating to tax deducted or collected at source and the beginning of subsequent Part B sections (Part B2, etc.). This physically prevents annexure entries found on later pages (such as Part B7 TDS-Ann.II-SAL Salary Annexure II) from leaking into Part B1, eliminating false duplicate salary records and double-counting in downstream modules (tax-calculator.ts, itr-classifier.ts, KPI cards).
2. Boundary-Based Detail Row Partitioning: In the supported AIS layout, the COUNT column in a summary header corresponds to active records, while the detail ledger may additionally contain Inactive rows. Rather than slicing a global flattened array by COUNT (which causes inactive rows to spill over and cascade shifts across subsequent deductors), the engine partitions text into isolated blocks between summary header $k$ and header $k+1$.
3. Block-Level Line Item Parsing (parseRegexLineItems / parsePipeLineItems): Extracts detail rows strictly within each deductor's block boundary, preserving all active and inactive records under their true parent deductor without row-shifting.
4. Defensive Filtering & Safe Fallbacks: Explicitly normalize and filter out any information codes starting with TDS-ANN.
   If block-level parsing produces zero line items for a deductor, any fallback parsing must remain strictly confined to that deductor's physical source block.
   The extractor must never assign rows from a global or remaining line-item pool to satisfy COUNT, because doing so can shift inactive or unmatched rows into subsequent deductors.
   If the deductor block cannot be parsed reliably, preserve the deductor summary where safely extractable, return no fabricated line items, and surface an internal parsing warning/status rather than borrowing rows from another block.
5. Hardcoded Entities Prohibited: Hardcoded deductor names or mock fallback entities are strictly prohibited. Empty defaults are returned if parsing fails.
10.5 Part B2 — Specified Financial Transactions (SFT)
Extracts information code, description, source entity, amount, and transaction date.
10.6 Part B3 — Tax Payments / Challans
Extracts financial year, major head, minor head, tax amount, total challan amount, BSR code, deposit date, and challan serial number.
10.7 Part B4 — Demand & Refund
Extracts financial year, mode, nature, amount, and date.
10.8 Web Worker Offloading Architecture (src/workers/extractor.worker.ts & src/lib/extractor-client.ts)
To improve UI responsiveness and reduce main-thread blocking during heavy extraction:
1. Background Processing Boundary: Deterministic text token extraction (extractStructuredData) and statutory ITR classification (classifyItr) execute inside a dedicated Web Worker (extractor.worker.ts).
2. Main Thread Decoupling: Canvas rendering and Mozilla PDF.js document decoding remain on the main thread, while pure CPU-bound regex tokenization runs asynchronously in the worker thread.
3. Resilient Fallback: The worker client (src/lib/extractor-client.ts) includes a resilient fallback to synchronous main-thread execution if Web Workers are unavailable or restricted by browser policies.
4. Structured Cloning Guarantee: Inputs (rawText: string) and outputs (StructuredExtractionResult, ItrClassificationResult) are structured-clone-compatible, containing no DOM references or non-transferable application state.
10.9 Statutory ITR Form Classification Engine (src/lib/itr-classifier.ts)
A deterministic, rule-based classifier evaluating extracted AIS signals and user-confirmed statutory criteria against Indian Income Tax Department (CBDT) filing rules for AY 2026-27 (ITR_ROUTING_RULE_VERSION = 'AY2026-27.1'):
1. ITR-1 (Sahaj) Eligibility Rules (AY 2026-27 Baseline):
   - House Property: Income from up to two house properties is permitted (AY 2026-27 statutory amendment). Income from more than two house properties bars ITR-1. If no business/professional-income routing applies, evaluate ITR-2.
   - Capital Gains: Long-term capital gains under Section 112A up to ₹1.25 lakh are compatible with ITR-1. Section 112A LTCG exceeding ₹1.25 lakh or any applicable short-term capital gain (STCG) bars ITR-1. If no business/professional-income routing applies, evaluate ITR-2; otherwise evaluate the applicable higher form.
   - Permitted Incomes: Salary / pension (Section 192), bank interest (Section 194A), and standard dividends (Section 194K).
   - Mandatory Income & Agricultural Caps: Total taxable income $\le ₹50,00,000$ (₹50 Lakhs); agricultural income $\le ₹5,000$.
2. Statutory Disqualifiers & Transaction Signals for ITR-2:
   - Capital Gains / Securities Activity Signal: Part B2 securities-related SFT records (SFT-017, SFT-018, LES, EMF, or equivalent supported codes) indicate securities/investment activity only.
     Raw SFT transaction values or gross consideration must not be interpreted as taxable capital gain, must not determine STCG vs LTCG, and must not be compared directly with the Section 112A ₹1.25 lakh gain threshold.
     Capital-gain classification requires sufficient gain-specific information, including applicable acquisition cost, sale consideration, acquisition and sale dates/holding period, statutory treatment, or explicit taxpayer confirmation.
     Until those facts are established, securities SFT records are advisory signals requiring user verification and must not by themselves disqualify ITR-1.
   - Immovable Property Transaction Signal: Land/building transaction in Part B2 SFT (SFT-012) or TDS u/s 194-IA. Note: A 194-IA record can represent a buyer of property (capital acquisition), not necessarily a seller realizing capital gain; this is treated as a property transaction signal requiring confirmation unless a capital gain/sale is explicitly established.
   - Foreign Remittance Signal: TCS u/s 206C(1G) indicates LRS/foreign remittance activity. It must not by itself be treated as definitive proof of a foreign asset, foreign-source income, or Schedule FA disclosure obligation; the advisor requests explicit user confirmation where required.
   - Lottery / Online Gaming / Crypto: Special rate winnings u/s 194B/194BA or VDA transfer u/s 194S.
   - Unlisted Shares & Directorship: Holding unlisted equity shares or directorship in a company.
3. Signals for Form ITR-3 / ITR-4:
   - Contractual payments (Section 194C) or professional/technical fees (Section 194J) indicate potential business or freelance income; they serve as signals requiring taxpayer classification/confirmation rather than automatically forcing PGBP exclusion.
4. Two-Tier Guidance Architecture:
   - Tier 1 (In-Worker Deterministic Evaluation): Automated inspection of all AIS tokens and transaction codes executed off-thread.
   - Tier 2 (Interactive User Verification on Main Page): The <ais-itr-advisor> component renders live checkboxes for non-AIS statutory facts (income > ₹50L, > 2 houses, directorship, unlisted shares) that dynamically elevate filing recommendations to ITR-2 right on the main page. The checklist is exclusively presented when the taxpayer is provisionally ITR-1; when AIS already establishes a confirmed statutory disqualifier, the external checklist omits conclusively resolved questions.
10.10 ITR-1 Tax Calculation & Dual-Regime Comparison Engine (AY 2026-27)
A dedicated local tax computation layer that evaluates income tax liability, tax refund vs payable, and regime comparison:
1. Current Implementation Scope & Calculator Eligibility:
   - ITR form eligibility and tax-calculator eligibility are separate concepts. Recommendation of ITR-1 does not imply that every income schedule or special-rate category permitted in ITR-1 is implemented by the calculator.
   - The calculator must expose an explicit eligibility/support decision before computation:
     
     interface CalculatorEligibility {
     
       supported: boolean;
     
       reasons: string[];
     
     }
   - If an otherwise ITR-1-compatible case contains an unsupported calculator category, including currently unimplemented Section 112A capital-gain computation, return an unsupported-calculation state rather than silently producing an incomplete tax result.
   - Tax-regime comparison is currently enabled only for supported ITR-1 income profiles.
   - ITR-2/3/4 tax computation is deferred until special-rate income, capital gains, foreign income, and business schedules are implemented.
2. Income Decomposition from AIS:
   - Salary Income: Gross amount credited under TDS-192.
   - Non-Salary Income: Bank deposit/savings interest under TDS-194A, dividends under TDS-194K, and other supported non-business receipts.
   - Gross Total Income (GTI): Computed from supported taxable income heads ($\text{Salary} + \text{Non-Salary}$), not from raw AIS transaction totals. SFT transaction values and gross remittance values must never be added directly to taxable income.
3. Pre-Paid Tax Credits:
   - Total TDS / TCS deposited across all deductors and collectors in Part B1 (accumulated from Active ledger items; Inactive/superseded records from deductor corrections are excluded to avoid duplicate claims).
   - Advance Tax & Self-Assessment Tax payments deposited in Part B3 (Challans).
4. Dual-Regime Computation (Official AY 2026-27 Slabs):
   - New Tax Regime (Section 115BAC - Default): Standard deduction of ₹75,000 for salary; revised slab rates:
     - 0% up to ₹4,00,000
     - 5% ₹4,00,001–₹8,00,000
     - 10% ₹8,00,001–₹12,00,000
     - 15% ₹12,00,001–₹16,00,000
     - 20% ₹16,00,001–₹20,00,000
     - 25% ₹20,00,001–₹24,00,000
     - 30% above ₹24,00,000
     - Section 87A Rebate: For an eligible resident individual under the New Tax Regime, rebate is available up to ₹60,000 where eligible total income does not exceed ₹12,00,000, subject to the statutory restriction on income taxed at special rates.
     - Section 87A Marginal Relief: Where eligible total income exceeds ₹12,00,000 marginally and the applicable income tax exceeds the amount by which total income exceeds ₹12,00,000, Section 87A marginal relief must be evaluated according to the applicable AY 2026-27 rules.
     - Section 87A marginal relief is distinct from surcharge marginal relief applicable at statutory high-income surcharge thresholds.
     - Do not infer Section 87A eligibility for special-rate income that is statutorily excluded.
   - Old Tax Regime (Optional): Standard deduction of ₹50,000 for salary; slab rates (0% up to ₹2.5L, 5% ₹2.5L-₹5L, 20% ₹5L-₹10L, 30% above ₹10L); Section 87A rebate up to ₹12,500 for taxable income $\le ₹5,00,000$; standard Chapter VI-A deductions (80C, 80D, 80CCD(1B), 80TTA, etc.) and Section 24(b) home loan interest.
Surcharge, Marginal Relief & Health and Education Cess
For both Old and New Tax Regimes, the tax engine must calculate tax in the following order:
1. Compute income tax at the applicable normal slab rates and any supported special rates.
2. Apply eligible Section 87A rebate and Section 87A marginal relief where applicable, producing income tax after rebate and Section 87A marginal relief prior to surcharge evaluation.
3. Apply surcharge when total income crosses the applicable statutory surcharge threshold.
4. Apply surcharge marginal relief where the Income Tax rules require it.
5. Compute Health & Education Cess at 4% on:
   \(\text{Tax Base for Cess} = \text{Tax plus Surcharge after marginal relief}\)
   - Cess Invariant:
     The calculator must never compute cess as 4% of total income.
     
     Cess is computed at 4% of tax plus surcharge after marginal relief. Surcharge marginal relief adjusts overall tax-plus-surcharge liability rather than merely reducing the surcharge component.
   - Universal Cess Applicability: Health & Education Cess applies whenever there is tax liability; it is not triggered only when income exceeds ₹50 lakh. The ₹50 lakh threshold is relevant to surcharge applicability, not to cess applicability.
   - AY-Versioned Surcharge Rules: For AY 2026-27, individual surcharge handling must be assessment-year-versioned and must not be implemented as a single unconditional percentage. Surcharge thresholds and special-rate caps must belong to the AY-specific tax-rule configuration/module, not embedded directly inside UI components.
   - Special-Rate Income Surcharge Caps: Where special-rate income exists, including income covered by sections such as 111A, 112, 112A, dividend income, or other specially taxed categories, the engine must apply the applicable surcharge caps and marginal-relief rules rather than applying the ordinary surcharge percentage blindly to the entire tax amount.
Tax Calculation Pipeline & Component Breakdown

Gross Total Income

      ↓

Taxable Income

      ↓

Income Tax Before Rebate

      ↓

Less: Section 87A Rebate & Section 87A Marginal Relief, if applicable

      ↓

Income Tax After Rebate & Section 87A Marginal Relief

      ↓

Add: Surcharge, if applicable

      ↓

Apply: Surcharge Marginal Relief, if applicable

      ↓

Tax plus Surcharge after Marginal Relief

      ↓

Add: 4% Health & Education Cess

      ↓

Total Tax Liability

      ↓

Less: TDS / TCS / Advance Tax / Self-Assessment Tax

      ↓

Tax Payable or Refund

Documented Regime Tax-Result Contract
The engine exposes individual tax components explicitly rather than collapsing them into an opaque total:

interface RegimeTaxResult {

  grossTotalIncome: number;

  taxableIncome: number;


  incomeTaxBeforeRebate: number;

  rebate87A: number;

  marginalRelief87A: number;

  incomeTaxAfterRebateAnd87AMarginalRelief: number;


  surcharge: number;

  surchargeMarginalRelief: number;

  taxPlusSurchargeAfterMarginalRelief: number;


  healthEducationCess: number;

  totalTaxLiability: number;


  prepaidTaxes: number;


  netTaxPosition: number;

  netTaxStatus: 'PAYABLE' | 'REFUND' | 'NIL';

}

5. Tax Payable vs. Tax Refund Determination:
   - $\text{Net Position} = \text{Total Tax Liability} - \text{Pre-Paid Taxes (TDS / TCS / Advance Tax / Self-Assessment Tax)}$.
   - $\text{Net Position} > 0 \implies \text{Tax Payable}$ (netTaxStatus: 'PAYABLE'; Self-Assessment tax due).
   - $\text{Net Position} < 0 \implies \text{Tax Refund Due}$ (netTaxStatus: 'REFUND'; Refund claimable on filing).
   - $\text{Net Position} = 0 \implies \text{Nil Liability / Balanced}$ (netTaxStatus: 'NIL').
6. Regime Comparison & Tax Differential Guidance:
   - Identifies the regime with the lower modeled tax liability under entered assumptions ($\text{Differential} = |\text{Tax}{\text{Old}} - \text{Tax}{\text{New}}|$).
   - Provides breakeven deduction impact modelling and comparative tax observations.
   - The calculator may compare computed outcomes but must not represent them as personalized professional tax advice.
7. New Regime Deduction Constraints:
   - Under Section 115BAC, most Chapter VI-A deductions such as 80C, 80D, 80CCD(1B), and 80TTA are generally not available.
   - Do not classify Section 24(b) as a Chapter VI-A deduction; it is an allowance under Income from House Property. Its treatment depends on the nature of the house property and applicable new-regime rules: self-occupied interest is disallowed, whereas let-out property interest can be deducted against rental income subject to loss set-off rules. Section 80CCD(2) employer NPS contribution remains separately eligible subject to statutory conditions.
   - In <ais-tax-calculator>, deductions available only under the Old Tax Regime are excluded from computation when the New Tax Regime is selected.
   - The Old-Regime-only deduction editor is hidden/collapsed under the New Regime. Only deductions that are legally unavailable under the New Regime may be reset.
   - New-Regime-permitted deductions and allowances, including applicable Section 80CCD(2) employer contribution treatment, must be modeled independently and must never be erased by a blanket { ...DEFAULT_DEDUCTIONS } reset.
11. Extraction Invariants
- Never synthesize records solely to satisfy the UI;
- Never replace parsing ambiguity with guessed taxpayer data;
- Monetary values become numbers only after successful normalization;
- Unsupported or missing sections must not silently become fabricated records;
- Source-reported totals must not be silently overwritten by recalculated totals;
- Parser ambiguity should surface a warning internally;
- "Section absent" and "parser failure" must remain distinguishable;
- PAN/TAN matching must be bounded and case-safe;
- Schema validation occurs before downstream UI/export consumption;
- Part B2 SFT gross transaction values are transaction signals, not taxable gain values. They must never be converted into capital gains by assumption.
12. Failure & Status Model

type ExtractionStatus =

  | 'extracted'

  | 'not-present'

  | 'unsupported'

  | 'failed';


interface ExtractionSection<T> {

  status: ExtractionStatus;

  records: T[];

  warnings: string[];

}

This explicit status model prevents an empty array from ambiguously meaning both "the source document contains no records" and "the parser failed to extract the section."
User-facing error messages must avoid leaking sensitive taxpayer source data.
13. Canonical Developer JSON Schema
AisDeveloperSchema is the canonical normalized output contract:

export interface AisDeveloperSchema {

  financial_year: string;

  assessment_year: string;


  part_a_general_info: {

    name_of_assessee: string;

    pan: string;

    aadhaar: string;

    date_of_birth: string;

    mobile_number: string;

    email_address: string;

    address: string;

  };


  part_b1_tds_tcs_transactions: Array<{

    sr_no: number;

    information_code: string;

    information_description: string;

    information_source: string;

    total_amount_credited: number;

    line_items: Array<{

      sr_no?: number;

      quarter: string;

      date_of_payment: string;

      amount_paid_credited: number;

      tds_deducted: number;

      tds_deposited: number;

      status: string;

    }>;

  }>;


  part_b2_sft_transactions: Array<{

    sr_no: number;

    information_code: string;

    information_description: string;

    information_source: string;

    amount: number;

    transaction_date: string;

  }>;


  part_b3_tax_payments: Array<{

    financial_year: string;

    major_head: string;

    minor_head: string;

    tax_amount: number;

    total_challan_amount: number;

    bsr_code: string;

    date_of_deposit: string;

    challan_serial_number: number;

  }>;


  part_b4_demand_refunds: Array<{

    financial_year: string;

    mode: string;

    nature: string;

    amount: number;

    date: string;

  }>;

}

Financial Year vs Assessment Year:

- financial_year represents the source-document financial year (e.g. "2025-26").

- assessment_year represents the corresponding filing/rule year used by the ITR classifier and tax calculator (e.g. "2026-27").

- These values must not be treated as interchangeable.

- For example, Financial Year 2025-26 corresponds to Assessment Year 2026-27.


Statutory Period & Future Form 168 Year Model:

The current schema (financial_year and assessment_year) is strictly for the Income-tax Act, 1961 assessment-year-based implementation.

Form No. 168 under the Income-tax Act, 2025 represents a separate future statutory mode using tax_year, and must not fabricate financial_year or assessment_year, because the Income-tax Act, 2025 discontinues the assessment year framework. Form 168 documents emit an explicit FORM_168_FUTURE_MODE statutory warning and do not silently route through AY 2026-27 logic.

A future versioned architecture contract may model statutory periods as:



type StatutoryPeriod =

  | {

  regime: 'ITA_1961';

  financial_year: string;

  assessment_year: string;

}

  | {

  regime: 'ITA_2025';

  tax_year: string;

};



(This represents a future architecture contract only. The existing production schema must not be silently modified.)

Extractors, exporters, persistence, and UI consumers must not silently add incompatible fields.
14. Schema Versioning
Recommended extraction envelope:

type ExtractionStatus =

  | 'extracted'

  | 'not-present'

  | 'unsupported'

  | 'failed';


interface ExtractionWarning {

  code: string;

  section: 'A' | 'B1' | 'B2' | 'B3' | 'B4';

  message: string;

}


interface StructuredExtractionResult {

  schema_version: '1.0';

  extraction_rules_version: string;

  itr_routing_rule_version: string;

  tax_rule_version: string;

  document_type: 'AIS' | 'FORM_26AS';

  extraction: AisDeveloperSchema | null;


  section_statuses: {

    part_a: ExtractionStatus;

    part_b1: ExtractionStatus;

    part_b2: ExtractionStatus;

    part_b3: ExtractionStatus;

    part_b4: ExtractionStatus;

  };


  warnings: ExtractionWarning[];

}

Versioning Rules:
- Breaking schema changes require a version increment;
- Replacing the legacy ambiguous pre-ITA-2025 canonical field tax_year with financial_year and assessment_year is a breaking schema change if that contract was already released, exported, or persisted. In that case, a schema-version increment and explicit migration are required. This legacy field must not be confused with the distinct statutory tax_year concept used by the Income-tax Act, 2025.
- If that legacy ambiguous tax_year form of schema version 1.0 was never released, exported, or persisted in production, the corrected financial_year/assessment_year contract may define the initial 1.0 schema. Future ITA-2025 tax_year support must enter through its own versioned statutory-period contract rather than reviving the legacy field.
- The version number must not be changed arbitrarily; release/persistence history determines whether a migration and version increment are required.
- schema_version alone is insufficient because schema rules, ITR-routing rules, and tax rules evolve independently. Export, persistence, restoration, and worker messages must preserve all three versions (schema_version, itr_routing_rule_version, and tax_rule_version);
- Statutory Regime Identification in Rule Versions: Rule-version metadata (schema_version, itr_routing_rule_version, and tax_rule_version) must identify rules belonging to the applicable statutory regime. AY 2026-27 rules under the Income-tax Act, 1961 must never be treated as equivalent to Tax Year 2026-27 rules under the Income-tax Act, 2025 simply because both contain the string 2026-27. Future rule versions should make the regime unambiguous, for example: ITA1961-AY2026-27.x vs. ITA2025-TY2026-27.x. Do not rename an existing persisted constant unless implementation compatibility has been checked first;
- IndexedDB restoration must reject incompatible schema versions;
- Exporters must declare supported versions;
- Migrations must be explicit;
- Form 26AS expansion must not silently mutate existing AIS semantics.
Section Status & Warning Rules:
- An empty records array must never be the only mechanism used to represent both "section absent" and "parser failed". section_statuses is the authoritative machine-readable status for each supported document section.
- Extraction warnings must use stable warning codes and section identifiers so that callers can programmatically distinguish warning categories.
- Warning messages must never contain PAN, Aadhaar, names, addresses, account details, raw taxpayer text, passwords, or other sensitive payload.
- Exporters, persistence, UI consumers, and Web Worker messages must preserve the section_statuses and warnings information when transmitting or storing StructuredExtractionResult.
15. Web Component & UI Presentation Architecture
15.1 Web Component Suite
Components are standard Custom Elements following Stencil-like conventions:
- <ais-part-a>: Assessee profile and identity breakdown
- <ais-itr-advisor>: Statutory ITR form guidance (ITR-1 vs ITR-2/3/4) with dynamic checklist
- <ais-tax-calculator>: AY-versioned tax computation, Old vs New regime comparison, surcharge/cess breakdown, deduction modelling, and payable/refund presentation
- <ais-deductor-card>: TDS/TCS deductor entities with Total Amount Credited, Active TDS Deducted, and contextual Superseded/Inactive metric pills with CBDT explanation tooltip, alongside quarterly line item tables with Active (.status-pill-active) and Inactive (.status-pill-inactive) status indicators
- <ais-tax-payment-card>: Challan, BSR code, and advance/self-assessment payments
- <ais-kpi-card>: Metric summary KPI cards
Component Rules:
- Use the ais-* tag prefix;
- Primitive configuration may use observed attributes (e.g. tax-year, title, icon);
- Structured objects and arrays use reactive property setters/getters (element.data = ...);
- Use semantic HTML with @svinayaka/siddi-design-system classes;
- Use design-system tokens for all visual properties;
- Register with guarded customElements.define() calls (if (!customElements.get('ais-...')));
- Export registrations through src/components/index.ts.
Complex taxpayer records should never be serialized into HTML attributes.
15.2 Main Page ITR Advisor & Dedicated Part A / Part B Modal Window
Because the primary PDF document already renders the original tax filing layout directly in the viewer workspace, displaying duplicate full-width tab panes for Part A and Part B creates unnecessary screen competition. Meanwhile, statutory classification (ITR-1 / ITR-2 / ITR-3 / ITR-4) requires immediate visibility and interactive user verification.
To maximize clarity, speed, and analytical power:
1. Main Page Presentation (ITR Decision & Interactive Checklist): The primary results workspace permanently hosts the Statutory ITR Form Guidance & Advisor (<ais-itr-advisor>). This displays the real-time statutory recommendation badge (ITR-1 / ITR-2 / ITR-3 / ITR-4), eligible factors, CBDT disqualifiers, and the interactive external criteria checklist with checkboxes (e.g., total income > ₹50 Lakhs, owning multiple house properties, company directorship, unlisted equity shares). Toggling these checkboxes dynamically elevates the taxpayer recommendation right on the main page.
2. Dedicated AIS Details Modal Window (Part A & Part B Only): Detailed transaction ledgers that mirror the PDF contents — Part A (Assessee Profile), Part B1 (TDS/TCS Deductor Cards & Quarterly Line Items), Part B2 (SFT Transactions), Part B3 (Challan Tax Payments), and Part B4 (Demand/Refunds) — are housed exclusively inside a high-capacity, scrollable modal window (#aisModalBackdrop / .modal-card--ais-details).
3. Multi-Access Modal Triggers:
   - Floating Side Action Button (#btnFloatingAis): A persistent, high-visibility floating pill button on the screen edge (.ais-side-action-btn) providing 1-click modal access anywhere in the workspace.
   - Viewer Toolbar Button (#btnToolbarOpenAis): Embedded "Show AIS (Part A & B)" trigger located directly in the PDF canvas toolbar next to zoom and navigation controls.
   - Part B Schedules Navigator (#btnNavOpenAllModal & .part-b-nav-btn): Interactive schedule triggers situated within the main page Paired KPI Grid. Clicking #btnNavOpenAllModal opens the full modal; clicking any category trigger (B1 TDS/TCS, B2 SFT, B3 Challans, B4 Demand/Refund) opens the modal, automatically scrolls to the specified target section, and applies a temporary high-contrast visual focus highlight (.ais-section-highlight).
   - Note on Header Action: The redundant header button was retired to keep the document action bar uncluttered alongside "Upload Another File" (#reuploadBtn with upload icon).
4. Accessible Modal Controls: The modal supports keyboard-first and mouse dismissal via the header close button (#btnCloseAisModal), footer close button (#btnCloseAisModalFooter), backdrop click-outside, and the Escape key.
15.3 Sequential Main Page Flow & Tax Regime Comparison Placement
On the main results page, content follows a disciplined statutory analytical sequence:

               ┌──────────────────────────────────────────────────┐

               │ 1. Document Header & "Upload Another File"       │

               │    - File Name, Classification, Reupload Action  │

               └─────────────────────────┬────────────────────────┘

                                         │

                                         ▼

               ┌──────────────────────────────────────────────────┐

               │ 2. Paired KPI Metrics Grid                       │

               │    - Primary Metric (Left): Gross Amount Credited│

               │    - Part B Navigator (Right): B1–B4 Modal Links │

               │      with TDS Deducted, SFT, Paid, & Refunds     │

               └─────────────────────────┬────────────────────────┘

                                         │

                                         ▼

               ┌──────────────────────────────────────────────────┐

               │ 3. Statutory ITR Form Advisor (<ais-itr-advisor>)│

               │    - Recommended Form: ITR-1 / ITR-2 / 3 / 4     │

               │    - Statutory Routing Triggers & CBDT Factors   │

               │    - Interactive Statutory Checklist (Checkboxes)│

               └─────────────────────────┬────────────────────────┘

                                         │

                             Recommended Form = ITR-1?

                                         │

                        ┌────────────────┴────────────────┐

                       YES                                NO

                        │                                 │

                        ▼                                 ▼

              Calculator Eligibility?       ┌──────────────────────────────┐

                        │                   │ 4. Non-ITR-1 Tax Calculation │

               ┌────────┴────────┐          │    Notice                    │

              YES                NO         │    - Reflects classifier:    │

               │                  │         │      "Recommended Form:      │

               ▼                  ▼         │       ITR-2 / ITR-3 / ITR-4" │

  ┌────────────────────────┐ ┌────────────┐ │    - Tax calculation for the │

  │ 4a. Tax Regime         │ │ 4b. Unsup- │ │      recommended form is     │

  │     Calculator         │ │     ported │ │      outside current         │

  │     (ITR-1 Supported)  │ │     Calcu- │ │      calculator scope        │

  │     - Salary vs Non-   │ │     lation │ └──────────────┬───────────────┘

  │       Salary Income    │ │     Notice │                │

  │     - Old vs New       │ │     - With │                │

  │       Regime Baseline  │ │       `rea-│                │

  │     - Net Tax Payable  │ │       sons`│                │

  │       or Refund        │ └─────┬──────┘                │

  │     - Deduction        │       │                       │

  │       Modelling        │       │                       │

  └───────────┬────────────┘       │                       │

              │                    │                       │

              └────────────────────┴───────────────────────┘

                                   │

                                   ▼

               ┌──────────────────────────────────────────────────┐

               │ 5. High-DPI Retina PDF Canvas & Text Stream View │

               │    - Native page rendering & zoom controls       │

               └──────────────────────────────────────────────────┘

Presentation & Routing Invariants:
1. Calculator Decoupled from Form Eligibility: An ITR-1 recommendation does not automatically enable the tax calculator. CalculatorEligibility.supported must be true before tax computation begins.
   - When supported is false, the UI must display the reasons (CalculatorEligibility.reasons) in the Unsupported Calculation Notice and must not produce a partial or incomplete tax result.
   - A taxpayer may still be correctly classified as ITR-1 even when the current calculator does not implement one of the taxpayer's permitted schedules (for example, permitted Section 112A LTCG up to ₹1.25 lakh when capital-gain calculation is deferred).
2. Generic Form-Aware Non-ITR-1 Notice: When the classifier recommends a form other than ITR-1 (ITR-2, ITR-3, or ITR-4), the UI presents a generic, form-aware Non-ITR-1 Tax Calculation Notice.
   - The notice must use the actual classifier result, such as:
     - Recommended Form: ITR-2
     - Recommended Form: ITR-3
     - Recommended Form: ITR-4
   - It explains that tax calculation for that recommended form is outside the current calculator scope.
   - It must never hardcode "ITR-2" for branches that may resolve to ITR-3 or ITR-4.
16. Local Persistence (src/lib/storage.ts)
Tax-AIS supports optional local session recovery through IndexedDB to safeguard data across browser refreshes or system power-offs.
Persistence Contract
- Database: tax_ais_local_storage
- Storage: Browser-local IndexedDB only
- Retention: Strict 24-hour Time-To-Live (TTL)
- Payloads: Uploaded document binary buffer, normalized extraction result, and computed statutory ITR recommendation
- Passwords: Decryption passwords are never stored or persisted
- Cloud Synchronization: Prohibited (Zero server transmission)
- Clear Session: Removes source buffer and normalized data immediately
- Replacement Policy: A new upload automatically replaces the previous active session
- Startup Cleanup: Expired sessions (> 24 hours old) are purged before restoration
- Version Metadata: Persisted normalized data includes schema/version metadata
- Compatibility: Incompatible stored schema versions must not be silently coerced
[!NOTE]

Browser-local IndexedDB persistence provides locality, not encryption at rest. The application does not claim that persisted taxpayer data is cryptographically protected by Tax-AIS itself. Confidentiality of locally persisted records also depends on the browser profile, operating system, device security, and storage environment.


JavaScript memory must not be described as securely erasable. The application releases object references and purges IndexedDB records, but deterministic memory wiping is not guaranteed by browser runtimes.

17. Design System Architecture
All visual UI behavior is built on @svinayaka/siddi-design-system.
- Colors: Use --ksv-ds-* tokens exclusively (--ksv-ds-bg-canvas, --ksv-ds-border-default, --ksv-ds-text-primary, etc.);
- Spacing, Typography, Radii: Use design-system tokens (--ksv-ds-space-*, --ksv-ds-radius-*, --ksv-ds-font-*);
- Theme Switching: Synchronize both data-theme and data-ksv-ds-theme attributes on document.documentElement ("dark" or "light");
- Web Components: Must not bypass shared design-system semantics.
Hardcoded values are permitted only for non-themeable implementation mechanics where no suitable token exists, such as PDF-coordinate calculations or canvas rendering corrections.
18. Deployment & Static Hosting (Netlify)
Tax-AIS is deployed as a static client-side SPA with no application backend.
Build

npm run build

Deployment Rules
- Publish from dist/;
- Configuration is defined in [`netlify.toml`](./netlify.toml);
- Scoped packages are resolved using .npmrc;
- SPA fallback resolves application routes to /index.html;
- Static hosting must never accept taxpayer files or extraction payloads.
Security Headers & Content Security Policy

[[headers]]

  for = "/*"


  [headers.values]

    X-Frame-Options = "DENY"

    X-Content-Type-Options = "nosniff"

Production deployment requires an appropriate Content Security Policy (CSP) compatible with the locally bundled Vite/PDF.js worker architecture and no-remote-script model. An exact CSP string must not be invented unless tested against the actual build.
Browser DOM Security Rules
- Taxpayer-controlled and document-derived strings must be rendered using safe DOM APIs such as textContent or equivalent escaping/sanitization.
- Untrusted document-derived content must never be inserted through unsanitized innerHTML.
19. Architectural Decisions
| Decision | Choice | Reason |
| :--- | :--- | :--- |
| Processing Location | Browser only | Keeps taxpayer data strictly on-device |
| PDF Engine | Mozilla PDF.js | Mature, reliable in-browser PDF parsing |
| Extraction Model | Deterministic rules + spatial parsing | Explainability, repeatability, and zero hallucination |
| Canonical Model | AisDeveloperSchema | Stable, typed contract across UI, export, and persistence |
| UI Model | Native Web Components | Framework independence and component reuse |
| Styling | Siddi Design System | Shared tokens, themes, contrast, and visual consistency |
| Persistence | IndexedDB with 24h TTL | Session recovery across power-offs without server storage |
| Hosting | Static Netlify deployment | No application backend, reducing server-side application attack surface |
| Remote LLM Parsing | Not permitted | Preserves Zero Server Transmission guarantee |
20. Code Governance & Quality Gates
Implementation constraints and contribution rules are defined in [`AGENTS.md`](./AGENTS.md).
Architecture-Level Requirements:
- npm run sonar:check passes with 0 errors (ESLint + SonarJS + Stylelint + TypeScript);
- npm run build passes with 0 errors;
- Extraction code contains no mock taxpayer fallbacks;
- Sensitive data is never logged or transmitted;
- Design-system tokens govern all themeable UI;
- ais-* Web Component naming and registration conventions are preserved.
21. Architectural Consistency Rules
The following sources have distinct, authoritative responsibilities:
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — System boundaries, data flow, privacy model, deployment, architectural contracts;
- [`AGENTS.md`](./AGENTS.md) — Implementation rules, quality gates, AI-agent contribution behavior;
- [`src/types/ais.ts`](./src/types/ais.ts) — Canonical TypeScript contracts and interfaces;
- [`src/lib/extractor.ts`](./src/lib/extractor.ts) — Implemented extraction behavior;
- [`src/lib/itr-classifier.ts`](./src/lib/itr-classifier.ts) — Statutory ITR classification behavior;
- [`src/lib/tax-calculator.ts`](./src/lib/tax-calculator.ts) — AY-versioned income-tax computation, Old/New regime comparison, rebate, surcharge, marginal relief, Health & Education Cess, prepaid tax credits, and net tax-position behavior;
- [`src/lib/storage.ts`](./src/lib/storage.ts) — Local persistence behavior (IndexedDB 24h TTL);
- [`package.json`](./package.json) — Build, quality gate, and validation scripts;
- [`netlify.toml`](./netlify.toml) — Deployment and static-hosting policy.
When documentation conflicts with implementation, resolve the inconsistency explicitly.
Do not silently document capabilities that do not exist.
Do not describe Form 26AS as fully supported until its schema, extractor, persistence, UI, and export behavior are implemented and validated.