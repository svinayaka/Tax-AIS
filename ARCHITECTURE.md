# Architecture Documentation — Tax-AIS

> **System:** Indian Income Tax Annual Information Statement (AIS / Form 168) Extraction Engine & Visual Dashboard  
> **Repository:** [https://github.com/svinayaka/Tax-AIS.git](https://github.com/svinayaka/Tax-AIS.git)  
> **Design System:** `@svinayaka/siddi-design-system@1.0.0`  
> **Execution Paradigm:** 100% Client-Side / Zero Server Transmission  
> **Language / Stack:** TypeScript (Strict), Stencil / Web Components, Vite, Mozilla PDF.js

---

## 1. Architectural Philosophy & Privacy Model

**Tax-AIS** is engineered specifically for privacy-first extraction and visualization of Indian Income Tax documents, including the **Annual Information Statement (AIS / Form 168)** and **Form 26AS**.

### Privacy & Security Guarantees
- **Zero Server Transmission**: All PDF binary parsing, regex tokenization, spatial reconstruction, and data visualization execute entirely within the client's web browser sandbox.
- **No Remote Telemetry or Storage**: Tax documents contain sensitive identity data (PAN, Aadhaar, bank records, and challan payments). No document buffers, parsed JSON objects, or telemetry are transmitted over the network.
- **Client-Side Password Unlocking**: Encrypted PDFs are decrypted in-memory using Mozilla PDF.js password hooks (`PAN in UPPERCASE + DOB in DDMMYYYY`) without persisting passwords.

```
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
|  | - Retina HiDPI Canvas rasterizer                                        |  |
|  +-------------------------------------------------------------------------+  |
|         |                                                                     |
|         v (Spatial Text Lines)                                                |
|  +-------------------------------------------------------------------------+  |
|  | Deterministic Extraction Engine (`src/lib/extractor.ts`)                |  |
|  | - Document classifier & entity extractors (PAN, Aadhaar, Dates, Money)  |  |
|  | - Part A Assessee profile extraction                                    |  |
|  | - Part B1 TDS/TCS deductor grouping & quarterly line item matching     |  |
|  | - Part B3 Tax payment (Challan) spatial parser                          |  |
|  +-------------------------------------------------------------------------+  |
|         |                                                                     |
|         v (Structured `AisDeveloperSchema` & `StructuredExtractionResult`)    |
|  +-------------------------------------------------------------------------+  |
|  | Reactive UI & Web Components (`src/components/`, `src/main.ts`)        |  |
|  | - Custom Elements: <ais-part-a>, <ais-deductor-card>, <ais-kpi-card>    |  |
|  | - Design Tokens: @svinayaka/siddi-design-system (`--ksv-ds-*`)          |  |
|  | - Exporter (`src/lib/exporter.ts`): JSON, CSV, Markdown, Print         |  |
|  +-------------------------------------------------------------------------+  |
|                                                                               |
+-------------------------------------------------------------------------------+
```

---

## 2. Component & Directory Structure

```
Tax-AIS/
├── .husky/                   # Git hooks (pre-commit quality gates)
├── public/                   # Static assets & sample files
├── src/
│   ├── components/           # Stencil / Custom Element UI components
│   │   ├── ais-deductor-card.ts    # TDS/TCS deductor entity & quarterly line items
│   │   ├── ais-kpi-card.ts         # Metric KPI cards (Total TDS, Tax Paid, Assessee)
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
│   └── style.css             # Design tokens & layouts (@svinayaka/siddi-design-system)
├── .eslintrc.js              # ESLint configuration with SonarJS rules
├── .lintstagedrc.json        # Staged files linter & type-check orchestrator
├── .stylelintrc.json         # Stylelint configuration extending standard CSS rules
├── AGENTS.md                 # Developer & AI Agent contribution standards
├── ARCHITECTURE.md           # System architecture documentation
├── index.html                # Single-page application shell
├── package.json              # Project dependencies, scripts, and quality gates
├── sonar-project.properties  # SonarQube / SonarCloud configuration
└── tsconfig.json             # Strict TypeScript compiler configuration
```

---

## 3. Core Modules & Data Flow

### 3.1 Binary Spatial PDF Reconstruction (`src/lib/pdf-parser.ts`)
Standard PDF text extraction often drops spatial relationships, mixing horizontal table columns or interleaving multi-line cells. `pdf-parser.ts` handles spatial reconstruction:

1. **Affine Transform Translation**: Maps PDF viewport coordinates $(x, y)$ to standard DOM space, adjusting for device pixel ratios (Retina HiDPI).
2. **Dynamic Line Grouping**: Sorts raw text items vertically by Y-coordinate, grouping tokens within a vertical tolerance ($\Delta y \le 5\text{px}$) into coherent horizontal lines.
3. **Horizontal Spacing Reconstruction**: Calculates horizontal gaps $(\Delta x)$ between adjacent text items to accurately preserve whitespace delimiters without arbitrary character merging.

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

### 3.2 Deterministic Extraction Engine (`src/lib/extractor.ts`)
The extraction engine takes raw space-delimited PDF streams, pipe-delimited text, or CSV files and produces a typed `StructuredExtractionResult` and `AisDeveloperSchema`:

1. **Document Classifier**: Clustered keyword scoring categorizes documents (AIS / Form 168, Form 26AS, Invoices, Financial Statements).
2. **Entity Tokenizer**: Regex tokenizers extract PAN (`[A-Z]{5}[0-9]{4}[A-Z]`), Aadhaar (`XXXX XXXX \d{4}`), mobile numbers, emails, monetary values, and dates.
3. **Part A (Assessee Profile)**: Extracts PAN, masked Aadhaar, legal name, DOB, phone, email, and multi-line residential address.
4. **Part B1 (TDS/TCS Deductors & Quarterly Line Items)**:
   - **3-Stage Resolution**:
     - *Stage 1*: Pipe/CSV-delimited tables.
     - *Stage 2*: PDF space-delimited text streams matching information code (`TDS-393(1)[Table: ...]`), description, deductor name, TAN, count, and amount.
     - *Stage 3*: TAN pattern heuristic (`\([A-Z]{4}\d{5}[A-Z]\)`) to dynamically discover and group line items without hardcoded entity names.
5. **Part B3 (Tax Payments / Challans)**:
   - Parses Financial Year (`YYYY-YY`), major head (`Income Tax`), minor head (`Self Assessment`, `Advance Tax`), 7-digit BSR code (`0180002`), deposit date, Challan Serial Number (`27897`), and CIN.

### 3.3 Web Component Layer (`src/components/`)
Built with standard Custom Elements and Stencil-compatible component contracts:
- `<ais-part-a>`: Displays assessee identity badges, PAN, Aadhaar, contact details, and address.
- `<ais-deductor-card>`: Displays deductor entities, TAN badges, summary totals, and an interactive quarterly breakdown table.
- `<ais-tax-payment-card>`: Renders tax payment challans with BSR codes, deposit dates, and serial numbers.
- `<ais-kpi-card>`: Renders top-level financial metrics (Total TDS Credited, Total Tax Deposited, Active Deductor count).

---

## 4. Developer Schema Contract

When extraction is completed, the data is structured strictly according to the `AisDeveloperSchema` contract:

```typescript
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
```

---

## 5. Design System Integration (`@svinayaka/siddi-design-system`)

All UI styling, cards, tables, modals, and buttons use `@svinayaka/siddi-design-system` design tokens:

### Token Categories
- **Surfaces & Canvases**: `var(--ksv-ds-bg-canvas)`, `var(--ksv-ds-bg-surface)`, `var(--ksv-ds-bg-surface-elevated)`, `var(--ksv-ds-bg-glass-card)`
- **Typography & Text**: `var(--ksv-ds-text-primary)`, `var(--ksv-ds-text-secondary)`, `var(--ksv-ds-text-tertiary)`, `var(--ksv-ds-text-brand)`
- **Status Tokens**:
  - Success: `var(--ksv-ds-status-success-bg)`, `var(--ksv-ds-status-success-text)`, `var(--ksv-ds-status-success-icon)`
  - Warning: `var(--ksv-ds-status-warning-bg)`, `var(--ksv-ds-status-warning-text)`, `var(--ksv-ds-status-warning-icon)`
  - Danger: `var(--ksv-ds-status-danger-bg)`, `var(--ksv-ds-status-danger-text)`, `var(--ksv-ds-status-danger-icon)`
  - Info: `var(--ksv-ds-status-info-bg)`, `var(--ksv-ds-status-info-text)`, `var(--ksv-ds-status-info-icon)`
- **Theme Synchronization**: Theme manager toggles both `data-theme` and `data-ksv-ds-theme` attributes on `document.documentElement` (`"dark"` or `"light"`).

---

## 6. Code Quality, SonarQube & Pre-Commit Quality Gates

The codebase enforces strict quality gates on every Git commit via **Husky**, **lint-staged**, **ESLint with SonarJS**, **Stylelint**, and the **TypeScript compiler**:

```
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
```

### SonarJS Rules Enforced
1. **Regular Expression Safety**:
   - Case-insensitive flags (`/i` or `/gi`) require normalized lowercase character classes (`[a-z0-9]`) to avoid `sonarjs/duplicates-in-character-class`.
   - Prevent ReDoS / catastrophic backtracking (`sonarjs/slow-regex`) with bounded quantifiers.
2. **Cognitive Complexity**: Modules maintain Cognitive Complexity $\le 30$.
3. **Dead Store & Unused Code**: Elimination of redundant variable assignments and unused branches.
4. **Extraction Integrity**: Zero mock fallback injection—parsers must dynamically extract data or return clean empty sets.

---

## 7. Verification & Build Commands

```bash
# Start local development server (Vite)
npm run dev

# Run full SonarQube, Stylelint & TypeScript quality check
npm run sonar:check

# Run SonarScanner analysis
npm run sonar:scan

# Run ESLint & SonarJS checks
npm run lint

# Run Stylelint CSS checks
npm run stylelint

# Build production bundle
npm run build

# Preview production build
npm run preview
```
