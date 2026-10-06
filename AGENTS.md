AGENTS.md — Developer & AI Agent Guidelines
Project: Tax-AIS (Indian Income Tax Annual Information Statement / Form 168 Extraction Engine)
Repository: https://github.com/svinayaka/Tax-AIS.git
Design System: @svinayaka/siddi-design-system@1.0.0
Language / Framework: TypeScript (Strict), Web Components (Stencil-like conventions), Vite, PDF.js
Code Quality: SonarQube (eslint-plugin-sonarjs), Stylelint, Husky, lint-staged

1. Project Purpose & Architecture
Tax-AIS is a specialized, privacy-first, 100% in-browser extraction engine and visual dashboard for Indian Income Tax Annual Information Statement (AIS / Form 168) and Form 26AS documents.
Current scope: AIS / Form 168 extraction is fully supported. Form 26AS support is partial/planned; do not assume Form 26AS fields exist unless the extractor and schema explicitly include them.
Key Architecture Modules (TypeScript)
- src/types/ais.ts: Strict TypeScript interfaces and developer schema contract (PartAGeneralInfo, PartB1TdsTcsTransaction, PartB3TaxPayment, AisDeveloperSchema, StructuredExtractionResult, ItrClassificationResult).
- src/lib/pdf-parser.ts: Binary PDF reader powered by Mozilla PDF.js. Handles spatial layout reconstruction, line grouping with tolerance, and encrypted PDF password callbacks (PAN + DDMMYYYY) with HiDPI Retina canvas scaling.
- src/lib/extractor.ts: Deterministic rule-based and spatial extractor for Part A (Assessee Profile) and Part B (B1 TDS/TCS, B2 SFT, B3 Tax Payments / Challans, B4 Demand & Refund).
- src/lib/itr-classifier.ts: Statutory ITR Form Classification Engine (ITR-1 Sahaj vs ITR-2 / ITR-3 / ITR-4) evaluating CBDT rules against AIS transactions.
- src/lib/extractor-client.ts: Web Worker orchestrator and resilient main-thread fallback manager.
- src/workers/extractor.worker.ts: Dedicated background Web Worker executing pure token extraction and ITR classification off the main UI thread.
- src/workers/ROUTER_AGENT.md: System directive and statutory routing rules matrix for ITR-1 vs ITR-2 classification.
- src/lib/exporter.ts: Multi-format exporter producing strict JSON Schema, tax filing CSV, and Markdown reports.
- src/components/: Web Component suite (<ais-part-a>, <ais-itr-advisor>, <ais-deductor-card>, <ais-tax-payment-card>, <ais-kpi-card>).
- src/style.scss: Design tokens and styling built entirely on top of @svinayaka/siddi-design-system.
- src/main.ts: Application orchestrator, multi-format ingestion (PDF, TXT, CSV, JSON), AIS Details Modal manager (Part A & Part B), theme manager, and event router.
2. Strict Design System Guidelines (@svinayaka/siddi-design-system)
All visual styling, layouts, components, and templates in this workspace MUST adhere to @svinayaka/siddi-design-system tokens.
Token Rules
1. Never use ad-hoc hardcoded hex colors or arbitrary values for themeable properties. Always use the --ksv-ds-* variables.
2. Color Tokens:
   - Canvas/Backgrounds: var(--ksv-ds-bg-canvas), var(--ksv-ds-bg-surface), var(--ksv-ds-bg-surface-elevated), var(--ksv-ds-bg-glass-card)
   - Text Colors: var(--ksv-ds-text-primary), var(--ksv-ds-text-secondary), var(--ksv-ds-text-tertiary), var(--ksv-ds-text-brand), var(--ksv-ds-text-link)
   - Status Colors:
     - Success: var(--ksv-ds-status-success-text), var(--ksv-ds-status-success-bg), var(--ksv-ds-status-success-icon)
     - Warning: var(--ksv-ds-status-warning-text), var(--ksv-ds-status-warning-bg), var(--ksv-ds-status-warning-icon)
     - Danger: var(--ksv-ds-status-danger-text), var(--ksv-ds-status-danger-bg), var(--ksv-ds-status-danger-icon)
     - Info: var(--ksv-ds-status-info-text), var(--ksv-ds-status-info-bg), var(--ksv-ds-status-info-icon)
   - Borders: var(--ksv-ds-border-subtle), var(--ksv-ds-border-default), var(--ksv-ds-border-focus)
   - Radii: var(--ksv-ds-radius-sm), var(--ksv-ds-radius-md), var(--ksv-ds-radius-lg), var(--ksv-ds-radius-xl), var(--ksv-ds-radius-2xl), var(--ksv-ds-radius-full)
   - Typography & Spacing: var(--ksv-ds-font-sans), var(--ksv-ds-font-mono), var(--ksv-ds-space-1) through var(--ksv-ds-space-12)
3. Theme Switching: Synchronize both data-theme and data-ksv-ds-theme attributes on document.documentElement ("dark" or "light").
3. Web Component & Modal Presentation Standards
Components in src/components/ follow Stencil-like custom element conventions.
1. Naming: Custom Elements use the ais-* prefix (e.g. <ais-part-a>, <ais-itr-advisor>, <ais-deductor-card>, <ais-tax-payment-card>, <ais-kpi-card>).
2. Properties & Attributes:
   - Primitive configuration (such as tax-year, title, icon) is supported via observed attributes.
   - Complex structured data (objects/arrays) is passed via reactive property setters/getters (element.data = ..., element.deductor = ..., element.payments = ...).
3. DOM Encapsulation: Use semantic HTML with @svinayaka/siddi-design-system classes and tokens.
4. Registration: Ensure all components register through customElements.define() with guard check if (!customElements.get('tag-name')) and export through src/components/index.ts.
5. AIS Details Modal Window & Main Page Separation: The statutory ITR decision and interactive criteria checklist (<ais-itr-advisor>) are presented prominently on the main results page directly above the document viewer. In contrast, Part A (Assessee Profile) and Part B (B1 Deductors, B2 SFT, B3 Challans, B4 Demand & Refund) — which mirror the source document contents — are housed exclusively inside an accessible, scrollable modal window (<div id="aisModalBackdrop"> -> .modal-card--ais-details). The modal is launched via 3 entrypoints: the floating side action button (#btnFloatingAis), the document header button (#btnOpenAisModal), and the viewer toolbar button (#btnToolbarOpenAis). Dismissal supports close buttons, backdrop click-outside, and the Escape key.
6. Two-Tier Classification Pipeline: Tier 1 (automated rule-based evaluation) executes inside the Web Worker (extractor.worker.ts) using AIS transaction signals. Tier 2 (interactive external checklist with checkboxes) renders inside <ais-itr-advisor> on the main page for non-AIS statutory triggers (total income > ₹50L, multiple houses, company directorship, unlisted shares) to dynamically elevate to ITR-2.
7. Downstream ITR-1 Tax Calculation & Dual-Regime Comparison (AY 2026-27): When the taxpayer falls under ITR-1 (or provisional ITR-1), the application computes tax payable or refund for both New (Section 115BAC, ₹75k std deduction, revised slabs) and Old Regimes (₹50k std deduction, Chapter VI-A deductions), highlighting the optimal regime, estimated savings, and actionable tax optimization tips. When classified under ITR-2 or higher, this calculation is explicitly bypassed because complex capital gains, foreign assets, or business schedules require full ITR-2/3 computation.
   - Statutory Chapter VI-A Invalidation under New Tax Regime: Under Section 115BAC, deductions under Chapter VI-A (Section 80C, 80D, 80CCD(1B), 80TTA, Section 24b) are legally disallowed by CBDT.
   - Regime State Machine & Deduction Nullification: In `<ais-tax-calculator>`, the Chapter VI-A deduction customization editor is exclusively enabled when the Old Tax Regime is chosen. Whenever the user selects or switches to the New Tax Regime, the deduction customization panel is strictly hidden/collapsed, and all previously entered deduction values are automatically nullified to zero (`{ ...DEFAULT_DEDUCTIONS }`) to prevent erroneous assumptions or phantom deduction states.
4. Privacy & Client-Side Execution Guarantee
- Zero Server Transmission: All PDF parsing, regex extraction, spatial reconstruction, and data formatting MUST remain 100% in-browser.
- Sensitive Tax Data: Indian tax documents contain PAN, Aadhaar, bank details, and address records. Never add network telemetry, external tracking, or remote API transmission of document contents.
- No Sensitive Logging: Never log PAN, Aadhaar, full names, addresses, bank details, or passwords to the console, error trackers, or analytics.
- Password Support: If an encrypted AIS PDF is uploaded, prompt the user via the in-browser modal without storing or transmitting the password. Clear password references after decryption.
- Local Session Persistence (IndexedDB): Uploaded document binary and parsed results are saved 100% locally in IndexedDB (`tax_ais_local_storage`) with a strict 24-hour time-to-live (TTL). The session is automatically purged after 24 hours, or immediately replaced when the user uploads a new file or clicks 'Clear Session'. Zero data is ever sent to any remote server or persistent cloud storage.
- CSP & Workers: Keep PDF.js worker local. Avoid eval, new Function, and remote script loading.
5. Developer JSON Schema Contract
When extracting or processing AIS / Form 168 data, the JSON output must strictly match the following developer contract:
interface AisDeveloperSchema {
  tax_year: string; // e.g. "2026-27"
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
6. SonarQube, Stylelint & Code Quality Standards
Code quality and security analysis are strictly enforced on every commit using SonarQube / SonarCloud rules, SonarJS TypeScript Analyzers, and Stylelint.
SonarQube TypeScript Standards
1. SonarQube Configuration: Defined in sonar-project.properties:
   - sonar.projectKey=svinayaka_Tax-AIS
   - sonar.typescript.tsconfigPath=tsconfig.json
   - sonar.typescript.file.suffixes=.ts,.tsx
2. ESLint with SonarJS & TypeScript:
   - Implemented via eslint-plugin-sonarjs and @typescript-eslint in eslint.config.js.
   - Enforces Cognitive Complexity ≤ 15, dead code detection, redundant type aliases, duplicate branch detection, security hotspot checking, and clean modular logic.
3. Regular Expression & Pattern Safety Rules:
   - Case-Insensitivity (/i flag): When /i is specified, always use lowercase character classes (e.g., [a-z0-9-]) instead of [A-Z] or [A-Za-z] to prevent sonarjs/duplicates-in-character-class violations.
   - No Duplicates in Character Classes: Never duplicate characters or specify overlapping character ranges inside [...] (e.g., [a-zA-Z0-9._%+-]).
   - Prevent ReDoS (Catastrophic Backtracking): Avoid unbounded lazy quantifiers (.*?) between match groups. Use bounded negated character classes ([^|\n\r]+) or bounded lengths ([^\n\r]{0,80}?).
   - Email & Token Regexes: Use standard bounded delimiters with word boundaries (e.g., /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/).
4. Promise Rejection Safety (SonarQube typescript:S6671):
   - Always reject Promises with an `Error` instance (e.g. `reject(err || new Error('...'))`). Never reject with raw strings, nullish values, or arbitrary non-Error objects. Enforced by `@typescript-eslint/prefer-promise-reject-errors`.
5. Extraction Integrity & Zero Mock Fallbacks:
   - Parsing engines (src/lib/extractor.ts) must extract document content dynamically.
   - Never inject hardcoded dummy names, mock deductor entities, or dummy challans as fallbacks when document sections are empty or unparsed. Always return clean empty defaults ('', [], 0).
6. Stylelint Standards:
   - Implemented via stylelint.config.js extending stylelint-config-standard.
   - Validates all CSS against modern syntax standards and prevents style regressions.
7. Pre-Commit Hook Validation Workflow (Husky + lint-staged)
A Git pre-commit hook is active in .husky/pre-commit to prevent committing invalid code:

+-------------------------------------------------------------+

|                     git commit triggered                    |

+-------------------------------------------------------------+

                              |

                              v

  [Step 1] npx lint-staged (Auto-fix & validate staged files)

                              |

                              v

  [Step 2] tsc --noEmit (Strict TypeScript type-check)

                              |

                              v

  [Step 3] npm run sonar:check (Full SonarJS, Stylelint & TS check)

                              |

                              v

                 Commit Allowed or Rejected

If any SonarQube rule, Stylelint error, or TypeScript type error is detected, the commit will be automatically blocked until resolved.
8. Build, Lint & Quality Check Commands

# Start local development server

npm run dev

# Run comprehensive SonarQube, Stylelint & TypeScript verification

npm run sonar:check

# Run SonarScanner against SonarQube / SonarCloud server

npm run sonar:scan

# Run ESLint + SonarJS analysis

npm run lint

# Auto-fix ESLint + SonarJS issues

npm run lint:fix

# Run Stylelint analysis on all stylesheets

npm run stylelint

# Auto-fix Stylelint issues

npm run stylelint:fix

# Validate production TypeScript build (must compile with 0 errors)

npm run build

# Preview production build locally

npm run preview

9. Mandatory Instructions for Contributing AI Agents
1. Mandatory Quality Gate: Run npm run sonar:check and npm run build before committing any changes. Both commands MUST pass with 0 errors.
2. Zero SonarQube Smells: Do not introduce nested ternary operators, redundant assignments, regex duplicate character classes, unbounded wildcards (.*?), excessive cognitive complexity (> 15), or unhandled edge cases.
3. Zero Mock Fallbacks: Never return hardcoded mock data when parsing fails; return empty arrays or empty strings.
4. Strict CSS Tokens: Use @svinayaka/siddi-design-system tokens (--ksv-ds-*) exclusively for ALL values, including colors, typography, spacing, sizing (width/height), and media queries. Never add hardcoded hex colors, raw pixel lengths, or arbitrary breakpoints in CSS or component templates. If a specific sizing token doesn't exist, utilize the closest existing spacing or breakpoint token as much as possible; NEVER invent new variables or hardcode raw pixel values.
5. Responsive Layouts: Test desktop (1024px+), tablet (768px), and mobile (640px) breakpoints using standard design system tokens instead of arbitrary sizes.
6. Theme Support: Ensure both Light and Dark modes remain crisp, legible, and compliant with accessibility contrast ratios.