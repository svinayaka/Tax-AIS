System Architecture — Tax-AIS
System: Indian Income Tax Annual Information Statement (AIS / Form 168) Extraction Engine & Visual Dashboard
Repository: https://github.com/svinayaka/Tax-AIS.git
Design System: @svinayaka/siddi-design-system@1.0.0
Execution Paradigm: 100% Client-Side / Zero Server Transmission
Language / Stack: TypeScript (Strict), Web Components (Stencil-like conventions), Vite, Mozilla PDF.js

1. Architectural Philosophy & Privacy Model
Tax-AIS is engineered specifically for privacy-first extraction and visualization of Indian Income Tax documents, including the Annual Information Statement (AIS / Form 168) and Form 26AS.
Current scope: AIS / Form 168 extraction is fully supported. Form 26AS support is partial/planned; do not assume Form 26AS fields exist unless the extractor and schema explicitly include them.
Privacy & Security Guarantees
- Zero Server Transmission: All PDF binary parsing, regex tokenization, spatial reconstruction, data normalization, and visualization execute entirely within the client's web browser.
- No Remote Telemetry or Storage: Tax documents contain sensitive identity and financial data, including PAN, Aadhaar, bank records, addresses, and challan payments. No document buffers, parsed JSON objects, or extracted tax data are transmitted over the network.
- No Sensitive Logging: Never log PAN, Aadhaar, full names, addresses, bank details, passwords, or extracted document contents to the console, analytics, or error tracking systems.
- Client-Side Password Unlocking: Encrypted PDFs are decrypted in memory using Mozilla PDF.js password hooks. Password references must not be persisted and should be cleared after decryption.
- Local PDF.js Worker: The PDF.js worker must be bundled and served locally with the application.
- Content Security: Avoid eval, new Function, remote script loading, or any runtime mechanism that executes untrusted code.
+-------------------------------------------------------------------------------+
|                             CLIENT BROWSER ENVIRONMENT                        |
|                                                                               |
|  [Uploaded File] -> (PDF / TXT / CSV / JSON)                                  |
|         |                                                                     |
|         v                                                                     |
|  +-------------------------------------------------------------------------+  |
|  | Mozilla PDF.js Engine (`src/lib/pdf-parser.ts`)                         |  |
|  | - Binary stream decoding & password unlock callback                     |  |
|  | - Spatial text token extraction with coordinate grouping                |  |
|  | - Retina HiDPI canvas rasterization                                     |  |
|  +-------------------------------------------------------------------------+  |
|         |                                                                     |
|         v (Spatial Text Lines)                                                |
|  +-------------------------------------------------------------------------+  |
|  | Deterministic Extraction Engine (`src/lib/extractor.ts`)                |  |
|  | - Document classifier & entity extractors (PAN, Aadhaar, Dates, Money)  |  |
|  | - Part A Assessee profile extraction                                    |  |
|  | - Part B1 TDS/TCS deductor grouping & quarterly line-item matching      |  |
|  | - Part B2 SFT transaction extraction                                    |  |
|  | - Part B3 Tax payment / Challan spatial parser                          |  |
|  | - Part B4 Demand & Refund extraction                                    |  |
|  +-------------------------------------------------------------------------+  |
|         |                                                                     |
|         v (`AisDeveloperSchema` / `StructuredExtractionResult`)              |
|  +-------------------------------------------------------------------------+  |
|  | Reactive UI & Web Components (`src/components/`, `src/main.ts`)         |  |
|  | - Custom Elements: <ais-part-a>, <ais-deductor-card>, <ais-kpi-card>    |  |
|  | - Design Tokens: @svinayaka/siddi-design-system (`--ksv-ds-*`)         |  |
|  | - Exporter (`src/lib/exporter.ts`): JSON, CSV, Markdown, Print          |  |
|  +-------------------------------------------------------------------------+  |
|                                                                               |
+-------------------------------------------------------------------------------+
2. Component & Directory Structure
Tax-AIS/
├── .husky/                   # Git hooks (pre-commit quality gates)
├── public/                   # Static assets & sample files
│   ├── _redirects            # Netlify SPA routing fallback
│   ├── favicon.svg           # Application favicon
│   └── icons.svg             # SVG icon sprites
├── src/
│   ├── components/           # Web Components using Stencil-like conventions
│   │   ├── ais-deductor-card.ts    # TDS/TCS deductor entity & quarterly line items
│   │   ├── ais-kpi-card.ts         # Metric KPI cards
│   │   ├── ais-part-a.ts           # Assessee Profile & identity breakdown
│   │   ├── ais-tax-payment-card.ts # Part B3 Challan / BSR payment records
│   │   └── index.ts                # Component registry & customElements.define guards
│   ├── lib/                  # Core parsing & extraction libraries
│   │   ├── exporter.ts       # Multi-format exporter (JSON, CSV, Markdown)
│   │   ├── extractor.ts      # Spatial & deterministic regex extraction engine
│   │   └── pdf-parser.ts     # Mozilla PDF.js spatial coordinate reconstructor
│   ├── types/
│   │   └── ais.ts            # Strict TypeScript interfaces & schema contracts
│   ├── main.ts               # Application orchestrator, theme manager, file ingestion
│   └── style.scss            # Design tokens & layouts (@svinayaka/siddi-design-system)
├── eslint.config.js          # ESLint flat config with TypeScript + SonarJS
├── .lintstagedrc.json        # Staged-file validation configuration
├── .npmrc                    # GitHub Packages scoped registry auth configuration
├── stylelint.config.js       # Stylelint configuration extending standard CSS rules
├── AGENTS.md                 # Developer & AI Agent contribution guidelines
├── ARCHITECTURE.md           # System architecture documentation
├── index.html                # Single-page application shell
├── netlify.toml              # Netlify build, SPA routing & security headers config
├── package.json              # Project dependencies, scripts, and quality gates
├── sonar-project.properties  # SonarQube / SonarCloud configuration
└── tsconfig.json             # Strict TypeScript compiler configuration
If the actual repository uses different ESLint or Stylelint configuration filenames, the directory tree and AGENTS.md must be updated together so both documents remain authoritative and consistent.

3. Core Modules & Data Flow
3.1 Binary Spatial PDF Reconstruction (src/lib/pdf-parser.ts)
Standard PDF text extraction often drops spatial relationships, mixes horizontal table columns, or interleaves multi-line cells. pdf-parser.ts handles spatial reconstruction:
1. Affine Transform Translation: Maps PDF viewport coordinates (x, y) into the application's coordinate space while accounting for device pixel ratio and HiDPI rendering.
2. Dynamic Line Grouping: Sorts raw text items vertically by Y-coordinate and groups tokens within a vertical tolerance such as Δy ≤ 5px.
3. Horizontal Spacing Reconstruction: Calculates horizontal gaps Δx between adjacent text items to preserve whitespace delimiters and table structure without arbitrary character merging.
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
3.2 Deterministic Extraction Engine (src/lib/extractor.ts)
The extraction pipeline accepts spatially reconstructed PDF text, plain or pipe-delimited text, CSV, and supported structured JSON input. It normalizes supported document data into StructuredExtractionResult and AisDeveloperSchema.
1. Document Classifier: Clustered keyword scoring categorizes supported documents such as AIS / Form 168 and partially supported Form 26AS inputs. Do not infer unsupported Form 26AS fields.
2. Entity Tokenizer: Regex tokenizers identify PAN, masked Aadhaar variants, mobile numbers, emails, monetary values, and dates.
   - PAN example: /\b[a-z]{5}\d{4}[a-z]\b/i
   - TAN example: /\b[a-z]{4}\d{5}[a-z]\b/i
   - Aadhaar extraction should match only the masking formats explicitly supported by the extractor. Do not assume a single universal masked representation.
3. Part A (Assessee Profile): Extracts PAN, masked Aadhaar, legal name, DOB, phone, email, and multi-line residential address.
4. Part B1 (TDS/TCS Deductors & Quarterly Line Items):
   - 3-Stage Resolution:
     - Stage 1: Pipe/CSV-delimited tables.
     - Stage 2: PDF space-delimited text streams matching information code, description, deductor name, TAN, count, and amount.
     - Stage 3: TAN-pattern heuristics dynamically discover and group line items without hardcoded deductor names.
   - If a section cannot be parsed reliably, return empty defaults instead of mock or synthetic entities.
5. Part B2 (Specified Financial Transactions / SFT):
   - Extracts information code, description, reporting source, amount, and transaction date.
   - Missing or unsupported records resolve to empty arrays rather than synthesized data.
6. Part B3 (Tax Payments / Challans):
   - Parses Financial Year (YYYY-YY), major head, minor head, tax amount, total challan amount, 7-digit BSR code, deposit date, and Challan Serial Number.
7. Part B4 (Demand & Refund):
   - Extracts financial year, mode, nature, amount, and date.
   - Missing or unsupported sections resolve to empty arrays.
3.3 Web Component Layer (src/components/)
Built with standard Custom Elements following Stencil-like component conventions:
- <ais-part-a>: Displays assessee identity information, PAN, Aadhaar, contact details, and address.
- <ais-deductor-card>: Displays deductor entities, TAN metadata, summary totals, and quarterly line-item breakdowns.
- <ais-tax-payment-card>: Renders tax payment challans with BSR codes, deposit dates, and serial numbers.
- <ais-kpi-card>: Renders top-level financial metrics such as total TDS credited, total tax deposited, and active deductor count.
Primitive configuration is exposed through observed attributes where appropriate. Complex objects and arrays are passed through reactive property setters/getters.
4. Developer JSON Schema Contract
When extraction is completed, data is structured according to the AisDeveloperSchema contract:
export interface AisDeveloperSchema {
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
The schema is the authoritative output contract. Extractors, exporters, UI consumers, and future Form 26AS extensions must not silently introduce incompatible fields.
5. Design System Architecture (@svinayaka/siddi-design-system)
The user interface adheres to token-based design principles provided by @svinayaka/siddi-design-system:
- Design Tokens: Standardized CSS variables (--ksv-ds-*) manage background surfaces, text hierarchy, border radii, spacing, typography, semantic status indicators, sizing (width/height), and media query breakpoints. No raw pixel values or arbitrary CSS hardcoding is allowed.
- No Ad-Hoc Theme Values: Themeable visual properties, layouts, and responsive breakpoints must use design-system tokens instead of hardcoded colors, lengths, or arbitrary pixel values.
- Theme Synchronization: Theme switching updates both data-theme and data-ksv-ds-theme on document.documentElement.
- Component Consistency: Web Components should use semantic HTML and design-system classes/tokens without bypassing the shared visual system.
6. Deployment & Static Hosting Architecture (Netlify)
Tax-AIS is distributed as a fully static, client-side Single Page Application with no application backend.
- Build Pipeline: Executed via npm run build (tsc && vite build), generating optimized assets inside dist/.
- Publish Directory: Netlify serves from dist/ as defined in [`netlify.toml`](./netlify.toml).
- Package Registry Authentication: Scoped dependency @svinayaka/siddi-design-system is fetched from GitHub Packages through .npmrc, with the required token supplied through deployment environment configuration.
- SPA Fallback Routing: Wildcard application routes rewrite to /index.html through Netlify configuration and/or public/_redirects.
- Security Headers: Response headers should prevent unauthorized framing/clickjacking and MIME-type sniffing, including:
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
- Caching: Versioned assets under /assets/* may use long-lived immutable caching when filenames are content-hashed.
- No Tax-Document Backend: Uploaded files and extracted tax data must never be proxied, uploaded, or persisted by Netlify Functions or another remote service.
7. Code Governance & Development Standards
For detailed developer workflows, AI-agent rules, SonarQube requirements, regex safety, pre-commit hooks, and coding standards, refer to [`AGENTS.md`](./AGENTS.md).
Mandatory architecture-level governance rules include:
- npm run sonar:check must pass with 0 errors before changes are committed.
- npm run build must pass with 0 TypeScript or production build errors.
- Extraction code must not use hardcoded mock fallbacks.
- Sensitive taxpayer data must never be logged or transmitted.
- Themeable UI code must use @svinayaka/siddi-design-system tokens.
- Web Components must preserve the ais-* naming and registration conventions.
See [`AGENTS.md`](./AGENTS.md) Sections 6–9 for the current quality gates, build commands, pre-commit workflow, and mandatory AI-agent contribution rules.
8. Architectural Consistency Rules
The following documents and implementation areas must remain synchronized:
- ARCHITECTURE.md describes system structure, data flow, privacy boundaries, deployment, and architectural contracts.
- AGENTS.md defines implementation constraints, contribution rules, quality gates, and AI-agent behavior.
- src/types/ais.ts is the source of truth for TypeScript extraction contracts.
- src/lib/extractor.ts is the source of truth for supported extraction behavior.
- package.json is the source of truth for build and validation scripts.
- ESLint and Stylelint configuration filenames documented here must match the actual repository.
- Form 26AS must not be described as fully supported until its extractor, schema, fixtures, and UI support are explicitly implemented.
When documentation conflicts with implementation, resolve the inconsistency rather than silently documenting behavior that does not exist.