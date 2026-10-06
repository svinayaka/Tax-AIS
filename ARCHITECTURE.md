# System Architecture — Tax-AIS

- **System:** Indian Income Tax Annual Information Statement (AIS / Form 168) Extraction Engine & Visual Dashboard
- **Repository:** [https://github.com/svinayaka/Tax-AIS.git](https://github.com/svinayaka/Tax-AIS.git)
- **Design System:** `@svinayaka/siddi-design-system@1.0.0`
- **Execution Paradigm:** 100% Client-Side / Zero Server Transmission
- **Language / Stack:** TypeScript (Strict), Web Components (Stencil-like conventions), Vite, Mozilla PDF.js

---

## 1. System Overview

Tax-AIS is a privacy-first, browser-only extraction and visualization application for Indian Income Tax documents, primarily the Annual Information Statement (AIS / Form 168).

The system converts supported source files into a canonical typed data model, renders that model through reusable Web Components, and exports normalized data without transmitting taxpayer information to any remote service.

### Current Scope
- **AIS / Form 168:** Fully supported within the fields implemented by the current extractor and schema.
- **Form 26AS:** Partial/planned. Do not assume Form 26AS fields exist unless explicitly implemented in the extractor, types, UI, and exporters.
- **Supported Ingestion Formats:** PDF, TXT, CSV, and supported JSON.
- **Processing Location:** Browser only (100% client-side execution).

---

## 2. Architectural Principles

1. **Privacy First:** Sensitive taxpayer data remains strictly on the user's local device.
2. **Deterministic Extraction:** Prefer rule-based, spatial, and schema-driven extraction over opaque remote inference.
3. **Typed Canonical Model:** All supported extraction paths normalize into a stable TypeScript contract (`AisDeveloperSchema`).
4. **Separation of Concerns:** Input parsing, normalization, extraction, persistence, UI, and export remain modular.
5. **No Mock Data Fallbacks:** Missing or unparsed sections never produce synthetic names, deductors, challans, or transaction records. Always return clean empty defaults (`''`, `[]`, `0`).
6. **Explicit Failure Semantics:** "No data present" and "failed to parse" must not be treated as the same state internally.
7. **Design-System Compliance:** Themeable UI behavior must strictly use `@svinayaka/siddi-design-system` tokens (`--ksv-ds-*`).
8. **Static Deployment:** The production application has no application backend or cloud server.

---

## 3. Scope & Non-Goals

### In Scope
- AIS / Form 168 PDF reconstruction and extraction
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

### Explicit Non-Goals
The current architecture intentionally does not provide:
- Server-side taxpayer-document processing;
- Remote LLM parsing of taxpayer documents or extracted text;
- Cloud persistence or remote synchronization of taxpayer records;
- Remote telemetry containing document contents or extracted tax information;
- Tax filing or submission to the Income Tax Department;
- Automatic tax advice, liability determination, or legal interpretation;
- Complete Form 26AS support until explicitly implemented;
- OCR for image-only/scanned documents unless introduced through a separate architectural decision.

> [!IMPORTANT]
> Any future feature that transmits document-derived content externally requires a separate architecture decision, privacy review, user consent model, and an explicit update to the Zero Server Transmission guarantee.

---

## 4. Privacy Model & Trust Boundaries

### Privacy & Security Guarantees
- **Zero Server Transmission:** PDF parsing, text reconstruction, extraction, normalization, visualization, persistence, and export execute locally in the browser.
- **No Remote Telemetry or Storage:** Document buffers, parsed tax objects, normalized output, PAN, Aadhaar, names, addresses, bank information, challan details, and passwords must never be sent to analytics, error trackers, APIs, or cloud storage.
- **No Sensitive Logging:** Sensitive taxpayer data must not be written to `console.*`, telemetry, diagnostics, or error-reporting payloads.
- **Client-Side Password Unlocking:** Encrypted PDFs are decrypted in memory using Mozilla PDF.js password callbacks (PAN in UPPERCASE + DDMMYYYY). Password values are never persisted or cached.
- **Local PDF.js Worker:** The PDF.js worker is bundled and served locally from the application bundle.
- **Content Security:** Do not use `eval`, `new Function`, remote script loading, or similar mechanisms that execute untrusted code.
- **Static Hosting Boundary:** Netlify hosts static application assets only. It must not receive taxpayer documents or extraction payloads.

### Trust Boundaries

#### Trusted Application Code
- Bundled first-party TypeScript application source;
- Locally bundled Mozilla PDF.js worker;
- `@svinayaka/siddi-design-system`;
- Vite-generated static assets;
- Locally shipped application configuration.

#### Untrusted Inputs
- Uploaded PDF binary streams and file contents;
- PDF metadata;
- TXT / CSV / JSON file contents;
- File names;
- Encrypted PDF password inputs;
- Imported schema versions;
- User-pasted data.

All imported content must be treated strictly as data, never executable content.

---

## 5. High-Level Data Flow

```text
PDF / TXT / CSV / Supported JSON
              │
              ▼
      Input Format Adapter
              │
              ▼
      Normalization Layer
              │
              ▼
   Deterministic Extraction
      Part A / B1–B4
              │
              ▼
       Schema Validation
              │
              ▼
     AisDeveloperSchema
        ┌─────┴─────┐
        ▼           ▼
 Web Component UI  Exporter (JSON / CSV / MD)
        │
        ▼
 Local Persistence (IndexedDB 24h TTL)
```

**Canonical Rule:**
```text
Input Format  ≠  Extraction Logic  ≠  Canonical Schema
```

Each input format has its own adapter. Supported content is normalized before it reaches the canonical extraction and validation layers.

---

## 6. Supported Input Matrix

| Input | Support | Parsing Strategy | Network |
| :--- | :--- | :--- | :--- |
| **AIS PDF** | Full | PDF.js + spatial reconstruction + deterministic extractor | Never (Local) |
| **AIS TXT** | Supported | Text adapter + deterministic extractor | Never (Local) |
| **CSV** | Supported | Structured adapter + normalization | Never (Local) |
| **Tax-AIS JSON** | Supported | Schema detection + validation + normalization | Never (Local) |
| **Form 26AS PDF** | Partial / Planned | Only explicitly implemented sections | Never (Local) |
| **Unknown JSON** | Unsupported | Reject or surface validation error | Never (Local) |
| **Image-only scanned PDF** | Unsupported | No silent fallback (requires future OCR) | Never (Local) |

---

## 7. Component & Directory Structure

```text
Tax-AIS/
├── .husky/                     # Git pre-commit hooks (SonarQube, Stylelint, TypeScript)
├── public/                     # Static assets & routing
│   ├── _redirects              # Netlify SPA fallback routing
│   ├── favicon.svg             # Application favicon
│   └── icons.svg               # SVG icon sprites
├── src/
│   ├── components/             # Custom Elements (Stencil-like conventions)
│   │   ├── ais-deductor-card.ts    # TDS/TCS deductor entity & quarterly line items
│   │   ├── ais-kpi-card.ts         # Metric KPI card components
│   │   ├── ais-part-a.ts           # Assessee Profile & identity breakdown
│   │   ├── ais-tax-payment-card.ts # Part B3 Challan / BSR payment records
│   │   └── index.ts                # Component registry & customElements.define guards
│   ├── lib/                    # Core engines & utilities
│   │   ├── exporter.ts         # Multi-format exporter (JSON, CSV, Markdown)
│   │   ├── extractor.ts        # Spatial & deterministic regex extraction engine
│   │   ├── pdf-parser.ts       # Mozilla PDF.js spatial coordinate reconstructor
│   │   └── storage.ts          # IndexedDB persistence with 24h TTL
│   ├── types/
│   │   └── ais.ts              # Canonical TypeScript contracts & schema interfaces
│   ├── main.ts                 # Orchestrator, theme manager, file ingestion, storage init
│   └── style.scss              # Styling & tokens (@svinayaka/siddi-design-system)
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
```

If the repository structure changes, this tree and [`AGENTS.md`](./AGENTS.md) must be updated together.

---

## 8. Input Adapter Architecture

### 8.1 PDF Input Adapter
Responsible for binary stream decoding, encrypted-document password callbacks, PDF.js page iteration, text-item extraction with bounding boxes, spatial coordinates, line reconstruction, HiDPI Retina canvas rendering, and handoff to the normalization layer.

### 8.2 Text Input Adapter
Handles plain text and pipe-delimited content, normalizes line endings (`\r\n` to `\n`), cleans up trailing whitespace, and routes tokens to the deterministic extractor.

### 8.3 CSV Input Adapter
Handles delimiter parsing, quoted row normalization, header detection, numeric stripping/normalization, and supported column mapping.

### 8.4 JSON Input Adapter
The JSON path must:
1. Parse syntactically valid JSON;
2. Detect whether the payload matches a supported schema version;
3. Validate required structural contracts;
4. Normalize external field names into Tax-AIS canonical fields;
5. Reject unsupported or ambiguous schemas with actionable warnings.

An externally supplied JSON file must never be assumed to already match `AisDeveloperSchema`.

---

## 9. PDF Reconstruction (`src/lib/pdf-parser.ts`)

Standard PDF text extraction frequently loses spatial structure, particularly in multi-column tables and multi-line cells. `pdf-parser.ts` performs robust spatial reconstruction:

### Core Responsibilities
1. **Affine Transform Translation:** Maps PDF viewport coordinates $(x, y)$ into application coordinate space while accounting for device pixel ratio and HiDPI rendering.
2. **Dynamic Line Grouping:** Groups raw text tokens vertically using a proximity tolerance ($\Delta y \le 5\text{px}$).
3. **Horizontal Spacing Reconstruction:** Uses horizontal gaps $\Delta x$ between adjacent text tokens to preserve whitespace delimiters and tabular column boundaries without accidental character fusion.
4. **Password Callback Handling:** Solicits encrypted-document passwords (PAN + DOB) in memory without storing or transmitting them.
5. **HiDPI Rendering:** Scales canvas rasterization for high-density Retina displays.

```typescript
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
```

Implementation-specific thresholds may evolve. The architecture requires stable spatial reconstruction behavior, not a permanently fixed numeric threshold.

---

## 10. Extraction & Normalization (`src/lib/extractor.ts`)

### 10.1 Document Classification
Supported document classes remain intentionally narrow:
- `AIS`
- `FORM_26AS`
- `UNKNOWN`

### 10.2 Entity Extraction
Identifier and field extraction must use bounded, deterministic rules appropriate to supported source formats. Architecture requires:
- Boundary-safe matching (e.g. `/\b[a-z]{5}\d{4}[a-z]\b/i`);
- Case-insensitive identifier handling where applicable without character class duplicates;
- No catastrophic regex backtracking (ReDoS prevention);
- No synthetic or fabricated values.

### 10.3 Part A — Assessee Profile
Extracts supported legal name, PAN, masked Aadhaar, date of birth, mobile number, email address, and multi-line residential address.

### 10.4 Part B1 — TDS/TCS Transactions
Resolves deductor entities and quarterly line items using:
1. Structured / pipe-delimited records;
2. Reconstructed PDF table rows;
3. TAN-based pattern heuristics dynamically grouping line items.

Hardcoded deductor names or mock fallback entities are strictly prohibited.

### 10.5 Part B2 — Specified Financial Transactions (SFT)
Extracts information code, description, source entity, amount, and transaction date.

### 10.6 Part B3 — Tax Payments / Challans
Extracts financial year, major head, minor head, tax amount, total challan amount, BSR code, deposit date, and challan serial number.

### 10.7 Part B4 — Demand & Refund
Extracts financial year, mode, nature, amount, and date.

---

## 11. Extraction Invariants

- **Never synthesize records** solely to satisfy the UI;
- **Never replace parsing ambiguity** with guessed taxpayer data;
- **Monetary values become numbers** only after successful normalization;
- **Unsupported or missing sections** must not silently become fabricated records;
- **Source-reported totals** must not be silently overwritten by recalculated totals;
- **Parser ambiguity** should surface a warning internally;
- **"Section absent" and "parser failure"** must remain distinguishable;
- **PAN/TAN matching** must be bounded and case-safe;
- **Schema validation** occurs before downstream UI/export consumption.

---

## 12. Failure & Status Model

```typescript
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
```

This explicit status model prevents an empty array from ambiguously meaning both "the source document contains no records" and "the parser failed to extract the section."

User-facing error messages must avoid leaking sensitive taxpayer source data.

---

## 13. Canonical Developer JSON Schema

`AisDeveloperSchema` is the canonical normalized output contract:

```typescript
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
```

Extractors, exporters, persistence, and UI consumers must not silently add incompatible fields.

---

## 14. Schema Versioning

Recommended extraction envelope:

```typescript
interface StructuredExtractionResult {
  schema_version: '1.0';
  document_type: 'AIS' | 'FORM_26AS';
  extraction: AisDeveloperSchema;
}
```

### Versioning Rules:
- Breaking schema changes require a version increment;
- IndexedDB restoration must reject incompatible schema versions;
- Exporters must declare supported versions;
- Migrations must be explicit;
- Form 26AS expansion must not silently mutate existing AIS semantics.

---

## 15. Web Component Architecture

Components are standard Custom Elements following Stencil-like conventions:
- `<ais-part-a>`: Assessee profile and identity breakdown
- `<ais-deductor-card>`: TDS/TCS deductor entities and quarterly tables
- `<ais-tax-payment-card>`: Challan, BSR code, and advance/self-assessment payments
- `<ais-kpi-card>`: Metric summary KPI cards

### Component Rules:
- Use the `ais-*` tag prefix;
- Primitive configuration may use observed attributes (e.g. `tax-year`, `title`, `icon`);
- Structured objects and arrays use reactive property setters/getters (`element.data = ...`);
- Use semantic HTML with `@svinayaka/siddi-design-system` classes;
- Use design-system tokens for all visual properties;
- Register with guarded `customElements.define()` calls (`if (!customElements.get('ais-...'))`);
- Export registrations through `src/components/index.ts`.

Complex taxpayer records should never be serialized into HTML attributes.

---

## 16. Local Persistence (`src/lib/storage.ts`)

Tax-AIS supports optional local session recovery through IndexedDB to safeguard data across browser refreshes or system power-offs.

### Persistence Contract
- **Database:** `tax_ais_local_storage`
- **Storage:** Browser-local IndexedDB only
- **Retention:** Strict 24-hour Time-To-Live (TTL)
- **Payloads:** Uploaded document binary buffer and normalized extraction result
- **Passwords:** Decryption passwords are never stored or persisted
- **Cloud Synchronization:** Prohibited (Zero server transmission)
- **Clear Session:** Removes source buffer and normalized data immediately
- **Replacement Policy:** A new upload automatically replaces the previous active session
- **Startup Cleanup:** Expired sessions (> 24 hours old) are purged before restoration
- **Version Metadata:** Persisted normalized data includes schema/version metadata
- **Compatibility:** Incompatible stored schema versions must not be silently coerced

> [!NOTE]
> JavaScript memory must not be described as securely erasable. The application releases object references and purges IndexedDB records, but deterministic memory wiping is not guaranteed by browser runtimes.

---

## 17. Design System Architecture

All visual UI behavior is built on `@svinayaka/siddi-design-system`.
- **Colors:** Use `--ksv-ds-*` tokens exclusively (`--ksv-ds-bg-canvas`, `--ksv-ds-border-default`, `--ksv-ds-text-primary`, etc.);
- **Spacing, Typography, Radii:** Use design-system tokens (`--ksv-ds-space-*`, `--ksv-ds-radius-*`, `--ksv-ds-font-*`);
- **Theme Switching:** Synchronize both `data-theme` and `data-ksv-ds-theme` attributes on `document.documentElement` (`"dark"` or `"light"`);
- **Web Components:** Must not bypass shared design-system semantics.

Hardcoded values are permitted only for non-themeable implementation mechanics where no suitable token exists, such as PDF-coordinate calculations or canvas rendering corrections.

---

## 18. Deployment & Static Hosting (Netlify)

Tax-AIS is deployed as a static client-side SPA with no application backend.

### Build
```bash
npm run build
```

### Deployment Rules
- Publish from `dist/`;
- Configuration is defined in [`netlify.toml`](./netlify.toml);
- Scoped packages are resolved using `.npmrc`;
- SPA fallback resolves application routes to `/index.html`;
- Static hosting must never accept taxpayer files or extraction payloads.

### Security Headers
```toml
[[headers]]
  for = "/*"

  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
```

Additional CSP/security headers may be introduced if compatible with locally bundled PDF.js workers and the no-remote-script policy.

---

## 19. Architectural Decisions

| Decision | Choice | Reason |
| :--- | :--- | :--- |
| **Processing Location** | Browser only | Keeps taxpayer data strictly on-device |
| **PDF Engine** | Mozilla PDF.js | Mature, reliable in-browser PDF parsing |
| **Extraction Model** | Deterministic rules + spatial parsing | Explainability, repeatability, and zero hallucination |
| **Canonical Model** | `AisDeveloperSchema` | Stable, typed contract across UI, export, and persistence |
| **UI Model** | Native Web Components | Framework independence and component reuse |
| **Styling** | Siddi Design System | Shared tokens, themes, contrast, and visual consistency |
| **Persistence** | IndexedDB with 24h TTL | Session recovery across power-offs without server storage |
| **Hosting** | Static Netlify deployment | Zero application backend attack surface |
| **Remote LLM Parsing** | Not permitted | Preserves Zero Server Transmission guarantee |

---

## 20. Code Governance & Quality Gates

Implementation constraints and contribution rules are defined in [`AGENTS.md`](./AGENTS.md).

### Architecture-Level Requirements:
- `npm run sonar:check` passes with **0 errors** (ESLint + SonarJS + Stylelint + TypeScript);
- `npm run build` passes with **0 errors**;
- Extraction code contains no mock taxpayer fallbacks;
- Sensitive data is never logged or transmitted;
- Design-system tokens govern all themeable UI;
- `ais-*` Web Component naming and registration conventions are preserved.

---

## 21. Architectural Consistency Rules

The following sources have distinct, authoritative responsibilities:
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — System boundaries, data flow, privacy model, deployment, architectural contracts;
- [`AGENTS.md`](./AGENTS.md) — Implementation rules, quality gates, AI-agent contribution behavior;
- [`src/types/ais.ts`](./src/types/ais.ts) — Canonical TypeScript contracts and interfaces;
- [`src/lib/extractor.ts`](./src/lib/extractor.ts) — Implemented extraction behavior and classification;
- [`src/lib/storage.ts`](./src/lib/storage.ts) — Local persistence behavior (IndexedDB 24h TTL);
- [`package.json`](./package.json) — Build, quality gate, and validation scripts;
- [`netlify.toml`](./netlify.toml) — Deployment and static-hosting policy.

When documentation conflicts with implementation, resolve the inconsistency explicitly.  
Do not silently document capabilities that do not exist.  
Do not describe Form 26AS as fully supported until its schema, extractor, persistence, UI, and export behavior are implemented and validated.