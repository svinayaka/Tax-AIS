System Architecture — Tax-AIS
System: Indian Income Tax Annual Information Statement (AIS / Form 168) Extraction Engine & Visual Dashboard
Repository: https://github.com/svinayaka/Tax-AIS.git
Design System: @svinayaka/siddi-design-system@1.0.0
Execution Paradigm: 100% Client-Side / Zero Server Transmission
Language / Stack: TypeScript (Strict), Web Components (Stencil-like conventions), Vite, Mozilla PDF.js

1. System Overview
Tax-AIS is a privacy-first, browser-only extraction and visualization application for Indian Income Tax documents, primarily the Annual Information Statement (AIS / Form 168).
The system converts supported source files into a canonical typed data model, renders that model through reusable Web Components, and exports normalized data without transmitting taxpayer information to any remote service.
Current Scope
- AIS / Form 168: Fully supported within the fields implemented by the current extractor and schema.
- Form 26AS: Partial/planned. Do not assume Form 26AS fields exist unless explicitly implemented in the extractor, types, UI, and exporters.
- Supported ingestion formats: PDF, TXT, CSV, and supported JSON.
- Processing location: Browser only.
2. Architectural Principles
1. Privacy First: Sensitive taxpayer data remains on the user's device.
2. Deterministic Extraction: Prefer rule-based, spatial, and schema-driven extraction over opaque remote inference.
3. Typed Canonical Model: All supported extraction paths normalize into a stable TypeScript contract.
4. Separation of Concerns: Input parsing, normalization, extraction, persistence, UI, and export remain modular.
5. No Mock Data Fallbacks: Missing or unparsed sections never produce synthetic names, deductors, challans, or transaction records.
6. Explicit Failure Semantics: "No data present" and "failed to parse" must not be treated as the same state internally.
7. Design-System Compliance: Themeable UI behavior must use @svinayaka/siddi-design-system.
8. Static Deployment: The production application has no application backend.
3. Scope & Non-Goals
In Scope
- AIS / Form 168 PDF reconstruction and extraction
- Part A assessee information
- Part B1 TDS/TCS transactions
- Part B2 SFT transactions
- Part B3 tax payments / challans
- Part B4 demand and refund records
- TXT / CSV / supported JSON ingestion
- Local session restoration
- JSON / CSV / Markdown / print export
- Light and dark theme support
- Static browser deployment
Explicit Non-Goals
The current architecture intentionally does not provide:
- server-side taxpayer-document processing;
- remote LLM parsing of taxpayer documents or extracted text;
- cloud persistence or synchronization of taxpayer records;
- remote telemetry containing document contents or extracted tax information;
- tax filing or submission to the Income Tax Department;
- automatic tax advice, liability determination, or legal interpretation;
- complete Form 26AS support until explicitly implemented;
- OCR for image-only/scanned documents unless introduced through a separate architectural decision.
Any future feature that transmits document-derived content externally requires a separate architecture decision, privacy review, consent model, and an explicit update to the Zero Server Transmission guarantee.
4. Privacy Model & Trust Boundaries
Privacy & Security Guarantees
- Zero Server Transmission: PDF parsing, text reconstruction, extraction, normalization, visualization, persistence, and export execute locally in the browser.
- No Remote Telemetry or Storage: Document buffers, parsed tax objects, normalized output, PAN, Aadhaar, names, addresses, bank information, challan details, and passwords must never be sent to analytics, error trackers, APIs, or cloud storage.
- No Sensitive Logging: Sensitive taxpayer data must not be written to console.*, telemetry, diagnostics, or error-reporting payloads.
- Client-Side Password Unlocking: Encrypted PDFs are decrypted in memory using Mozilla PDF.js password callbacks. Password values are never persisted.
- Local PDF.js Worker: The PDF.js worker is bundled and served locally.
- Content Security: Do not use eval, new Function, remote script loading, or similar mechanisms that execute untrusted code.
- Static Hosting Boundary: Netlify hosts static application assets only. It must not receive taxpayer documents or extraction payloads.
Trust Boundaries
Trusted Application Code
- bundled first-party TypeScript;
- locally bundled Mozilla PDF.js worker;
- @svinayaka/siddi-design-system;
- Vite-generated static assets;
- locally shipped application configuration.
Untrusted Inputs
- uploaded PDF contents;
- PDF metadata;
- TXT / CSV / JSON file contents;
- filenames;
- encrypted PDF passwords;
- imported schema versions;
- user-pasted data.
All imported content must be treated strictly as data, never executable content.
5. High-Level Data Flow
PDF / TXT / CSV / Supported JSON
              |
              v
      Input Format Adapter
              |
              v
      Normalization Layer
              |
              v
   Deterministic Extraction
      Part A / B1-B4
              |
              v
       Schema Validation
              |
              v
     AisDeveloperSchema
        /            \
       v              v
 Web Component UI   Exporter
       |
       v
 Local Persistence
The canonical rule is:
Input format ≠ extraction logic ≠ canonical schema

Each input format has its own adapter. Supported content is normalized before it reaches the canonical extraction and validation layers.
6. Supported Input Matrix
Input	Support	Parsing Strategy	Network
AIS PDF	Full	PDF.js + spatial reconstruction + deterministic extractor	Never
AIS TXT	Supported	Text adapter + deterministic extractor	Never
CSV	Supported	Structured adapter + normalization	Never
Tax-AIS JSON	Supported	Schema detection + validation + normalization	Never
Form 26AS PDF	Partial / planned	Only explicitly implemented sections	Never
Unknown JSON	Unsupported unless schema-recognized	Reject or surface validation error	Never
Image-only scanned PDF	Unsupported unless OCR is added later	No silent fallback	Never


7. Component & Directory Structure
Tax-AIS/
├── .husky/
├── public/
│   ├── _redirects
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── components/
│   │   ├── ais-deductor-card.ts
│   │   ├── ais-kpi-card.ts
│   │   ├── ais-part-a.ts
│   │   ├── ais-tax-payment-card.ts
│   │   └── index.ts
│   ├── lib/
│   │   ├── exporter.ts
│   │   ├── extractor.ts
│   │   ├── pdf-parser.ts
│   │   └── storage.ts
│   ├── types/
│   │   └── ais.ts
│   ├── main.ts
│   └── style.scss
├── eslint.config.js
├── .lintstagedrc.json
├── .npmrc
├── stylelint.config.js
├── AGENTS.md
├── ARCHITECTURE.md
├── index.html
├── netlify.toml
├── package.json
├── sonar-project.properties
└── tsconfig.json
If the repository structure changes, this tree and [`AGENTS.md`](./AGENTS.md) must be updated together.
8. Input Adapter Architecture
8.1 PDF Input Adapter
Responsible for binary loading, encrypted-document password callbacks, PDF.js page iteration, text-item extraction, spatial coordinates, line reconstruction, HiDPI rendering support, and handoff to normalization.
8.2 Text Input Adapter
Handles plain text, pipe-delimited content, normalized line endings, whitespace cleanup, and handoff to the deterministic extractor.
8.3 CSV Input Adapter
Handles delimiter parsing, row normalization, header detection, numeric normalization, and supported column mapping.
8.4 JSON Input Adapter
The JSON path must:
1. parse syntactically valid JSON;
2. detect whether the payload is a supported input schema;
3. validate required structure;
4. normalize external field names into Tax-AIS canonical fields;
5. reject unsupported or ambiguous schemas.
An externally supplied JSON file must never be assumed to already match AisDeveloperSchema.
9. PDF Reconstruction (src/lib/pdf-parser.ts)
Standard PDF text extraction frequently loses spatial structure, particularly in multi-column tables and multi-line cells.
Core Responsibilities
1. Affine Transform Translation: Maps PDF viewport coordinates into application coordinate space.
2. Dynamic Line Grouping: Groups tokens using a vertical tolerance such as Δy ≤ 5px.
3. Horizontal Spacing Reconstruction: Uses horizontal gaps Δx to preserve table and column separation.
4. Password Callback Handling: Requests encrypted-document passwords without persisting them.
5. HiDPI Rendering: Scales canvas output for Retina/high-density displays.
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
10. Extraction & Normalization (src/lib/extractor.ts)
10.1 Document Classification
Supported classes remain intentionally narrow:
AIS
FORM_26AS
UNKNOWN
10.2 Entity Extraction
Identifier and field extraction must use bounded, deterministic rules appropriate to supported source formats.
Architecture requires:
- boundary-safe matching;
- case-insensitive identifier handling where applicable;
- no catastrophic regex backtracking;
- no synthetic values.
10.3 Part A — Assessee Profile
Extracts supported legal name, PAN, masked Aadhaar, DOB, mobile number, email, and multi-line address.
10.4 Part B1 — TDS/TCS
Resolution may use:
1. structured / delimited records;
2. reconstructed PDF rows;
3. TAN-based grouping heuristics.
Hardcoded deductor names or mock fallback entities are prohibited.
10.5 Part B2 — SFT
Extracts information code, description, source, amount, and transaction date.
10.6 Part B3 — Tax Payments / Challans
Extracts financial year, major head, minor head, tax amount, total challan amount, BSR code, deposit date, and challan serial number.
10.7 Part B4 — Demand & Refund
Extracts financial year, mode, nature, amount, and date.
11. Extraction Invariants
- never synthesize records solely to satisfy the UI;
- never replace parsing ambiguity with guessed taxpayer data;
- monetary values become numbers only after successful normalization;
- unsupported or missing sections must not silently become fabricated records;
- source-reported totals must not be silently overwritten by recalculated totals;
- parser ambiguity should surface a warning internally;
- "section absent" and "parser failure" must remain distinguishable;
- PAN/TAN matching must be bounded and case-safe;
- schema validation occurs before downstream UI/export use.
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
This prevents an empty array from ambiguously meaning both "the source contains no records" and "the parser failed."
User-facing error messages must avoid including sensitive source data.
13. Canonical Developer JSON Schema
AisDeveloperSchema is the canonical normalized output contract.
export interface AisDeveloperSchema {
  tax_year: string;

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
Extractors, exporters, persistence, and UI consumers must not silently add incompatible fields.
14. Schema Versioning
Recommended envelope:
interface StructuredExtractionResult {
  schema_version: '1.0';
  document_type: 'AIS' | 'FORM_26AS';
  extraction: AisDeveloperSchema;
}
Rules:
- breaking schema changes require a version increment;
- IndexedDB restoration must reject incompatible versions;
- exporters must declare supported versions;
- migrations must be explicit;
- Form 26AS expansion must not silently mutate existing AIS semantics.
15. Web Component Architecture
Components are standard Custom Elements following Stencil-like conventions:
- <ais-part-a>
- <ais-deductor-card>
- <ais-tax-payment-card>
- <ais-kpi-card>
Rules:
- use the ais-* prefix;
- primitive configuration may use observed attributes;
- structured objects/arrays use property setters/getters;
- use semantic HTML;
- use design-system tokens;
- register with guarded customElements.define() calls;
- export registrations through src/components/index.ts.
Complex taxpayer records should not be serialized into HTML attributes.
16. Local Persistence (src/lib/storage.ts)
Tax-AIS supports optional local session recovery through IndexedDB.
Persistence Contract
- Database: tax_ais_local_storage
- Storage: browser-local IndexedDB only
- Retention: 24-hour TTL
- Payloads: source buffer and normalized extraction result
- Passwords: never persisted
- Cloud synchronization: prohibited
- Clear Session: removes source and normalized data
- Replacement policy: a new upload may replace the previous active session
- Startup cleanup: expired sessions are removed before restoration
- Version metadata: persisted normalized data includes schema/version metadata
- Compatibility: incompatible stored schema versions must not be silently coerced
JavaScript memory must not be described as securely erasable. The application can release references and purge IndexedDB records, but deterministic memory wiping is not guaranteed.
17. Design System Architecture
All visual UI behavior is built on @svinayaka/siddi-design-system.
- colors use --ksv-ds-* tokens;
- spacing, typography, radii, and supported responsive values should use design-system tokens where available;
- light/dark mode synchronizes both data-theme and data-ksv-ds-theme;
- Web Components should not bypass shared design-system semantics.
Hardcoded values are permitted only for non-themeable implementation mechanics where no suitable token exists, such as PDF-coordinate calculations or rendering corrections.
18. Deployment & Static Hosting (Netlify)
Tax-AIS is deployed as a static client-side SPA with no application backend.
Build
npm run build
Deployment Rules
- publish from dist/;
- configuration is defined in [`netlify.toml`](./netlify.toml);
- scoped packages are resolved using .npmrc;
- SPA fallback resolves application routes to /index.html;
- static hosting must never accept taxpayer files or extraction payloads.
Security Headers
[[headers]]
  for = "/*"

  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
Additional CSP/security headers may be introduced if compatible with locally bundled PDF.js workers and the no-remote-script policy.
19. Architectural Decisions
Decision	Choice	Reason
Processing location	Browser only	Keeps taxpayer data on-device
PDF engine	Mozilla PDF.js	Mature browser PDF parsing
Extraction model	Deterministic rules + spatial parsing	Explainability and reproducibility
Canonical model	AisDeveloperSchema	Stable contract across UI/export/persistence
UI model	Native Web Components	Framework independence and reuse
Styling	Siddi Design System	Shared tokens, themes, consistency
Persistence	IndexedDB with 24h TTL	Session recovery without server storage
Hosting	Static Netlify deployment	No application backend
Remote LLM parsing	Not permitted	Preserves zero-server-transmission guarantee


20. Code Governance & Quality Gates
Implementation constraints and contribution rules are defined in [`AGENTS.md`](./AGENTS.md).
Architecture-level requirements:
- npm run sonar:check passes with 0 errors;
- npm run build passes with 0 TypeScript/build errors;
- extraction code contains no mock taxpayer fallbacks;
- sensitive data is never logged or transmitted;
- design-system tokens govern themeable UI;
- ais-* Web Component naming and registration conventions are preserved.
21. Architectural Consistency Rules
The following sources have distinct responsibilities:
- ARCHITECTURE.md — system boundaries, data flow, privacy model, deployment, architectural contracts;
- AGENTS.md — implementation rules, quality gates, AI-agent contribution behavior;
- src/types/ais.ts — canonical TypeScript contracts;
- src/lib/extractor.ts — implemented extraction behavior;
- src/lib/storage.ts — local persistence behavior;
- package.json — build and validation scripts;
- netlify.toml — deployment and static-hosting policy.
When documentation conflicts with implementation, resolve the inconsistency explicitly.
Do not silently document capabilities that do not exist.
Do not describe Form 26AS as fully supported until its schema, extractor, persistence, UI, and export behavior are implemented and validated.