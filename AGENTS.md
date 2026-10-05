# AGENTS.md — Developer & AI Agent Guidelines

> **Project:** Tax-AIS (Indian Income Tax Annual Information Statement / Form 168 Extraction Engine)  
> **Repository:** [https://github.com/svinayaka/Tax-AIS.git](https://github.com/svinayaka/Tax-AIS.git)  
> **Design System:** `@svinayaka/siddi-design-system@1.0.0`  
> **Framework / Components:** Vanilla JS, Stencil / Web Components, Vite, PDF.js

---

## 1. Project Purpose & Architecture

**Tax-AIS** is a specialized, privacy-first, 100% in-browser extraction engine and visual dashboard for Indian Income Tax **Annual Information Statement (AIS / Form 168)** and **Form 26AS** documents.

### Key Architecture Modules
- **`src/lib/pdf-parser.js`**: Binary PDF reader powered by Mozilla PDF.js. Handles spatial layout reconstruction, line grouping with tolerance, and encrypted PDF password callbacks (`PAN + DDMMYYYY`).
- **`src/lib/extractor.js`**: Deterministic rule-based and spatial extractor for Part A (Assessee Profile) and Part B (B1 TDS/TCS, B2 SFT, B3 Tax Payments / Challans, B4 Demand & Refund).
- **`src/lib/exporter.js`**: Multi-format exporter producing strict JSON Schema, tax filing CSV, Markdown report, and print documents.
- **`src/components/`**: Stencil-compatible Web Component suite.
- **`src/style.css`**: Design tokens and styling built entirely on top of `@svinayaka/siddi-design-system`.
- **`src/main.js`**: Application orchestrator, theme manager, and event router.

---

## 2. Strict Design System Guidelines (`@svinayaka/siddi-design-system`)

All visual styling, layouts, components, and templates in this workspace **MUST** adhere to `@svinayaka/siddi-design-system` tokens.

### Token Rules
1. **Never use ad-hoc hardcoded hex colors or arbitrary values** for themeable properties. Always use the `--ksv-ds-*` variables.
2. **Color Tokens**:
   - Canvas/Backgrounds: `var(--ksv-ds-bg-canvas)`, `var(--ksv-ds-bg-surface)`, `var(--ksv-ds-bg-surface-elevated)`, `var(--ksv-ds-bg-glass-card)`
   - Text Colors: `var(--ksv-ds-text-primary)`, `var(--ksv-ds-text-secondary)`, `var(--ksv-ds-text-tertiary)`, `var(--ksv-ds-text-brand)`, `var(--ksv-ds-text-link)`
   - Status Colors:
     - Success: `var(--ksv-ds-status-success-text)`, `var(--ksv-ds-status-success-bg)`, `var(--ksv-ds-status-success-icon)`
     - Warning: `var(--ksv-ds-status-warning-text)`, `var(--ksv-ds-status-warning-bg)`, `var(--ksv-ds-status-warning-icon)`
     - Danger: `var(--ksv-ds-status-danger-text)`, `var(--ksv-ds-status-danger-bg)`, `var(--ksv-ds-status-danger-icon)`
     - Info: `var(--ksv-ds-status-info-text)`, `var(--ksv-ds-status-info-bg)`, `var(--ksv-ds-status-info-icon)`
   - Borders: `var(--ksv-ds-border-subtle)`, `var(--ksv-ds-border-default)`, `var(--ksv-ds-border-focus)`
   - Radii: `var(--ksv-ds-radius-sm)`, `var(--ksv-ds-radius-md)`, `var(--ksv-ds-radius-lg)`, `var(--ksv-ds-radius-xl)`, `var(--ksv-ds-radius-2xl)`, `var(--ksv-ds-radius-full)`
   - Typography & Spacing: `var(--ksv-ds-font-sans)`, `var(--ksv-ds-font-mono)`, `var(--ksv-ds-space-1)` through `var(--ksv-ds-space-12)`
3. **Theme Switching**: Synchronize both `data-theme` and `data-ksv-ds-theme` attributes on `document.documentElement` (`"dark"` or `"light"`).

---

## 3. Stencil & Web Component Standards

Components in `src/components/` follow Stencil / Custom Element lifecycle and conventions:

1. **Naming**: Custom Elements use the `ais-*` prefix (e.g. `<ais-part-a>`, `<ais-deductor-card>`, `<ais-tax-payment-card>`, `<ais-kpi-card>`).
2. **Properties & Attributes**:
   - Primitive configuration (such as `tax-year`, `title`, `icon`) is supported via observed attributes.
   - Complex structured data (objects/arrays) is passed via reactive property setters/getters (`element.data = ...`, `element.deductor = ...`, `element.payments = ...`).
3. **DOM Encapsulation**: Use semantic HTML with `@svinayaka/siddi-design-system` classes and tokens.
4. **Registration**: Ensure all components register through `customElements.define()` with guard check `if (!customElements.get('tag-name'))` and export through `src/components/index.js`.

---

## 4. Privacy & Client-Side Execution Guarantee

- **Zero Server Transmission**: All PDF parsing, regex extraction, spatial reconstruction, and data formatting MUST remain 100% in-browser.
- **Sensitive Tax Data**: Indian tax documents contain PAN, Aadhaar, bank details, and address records. Never add network telemetry, external tracking, or remote API transmission of document contents.
- **Password Support**: If an encrypted AIS PDF is uploaded, prompt the user via the in-browser modal without storing or transmitting the password.

---

## 5. Developer JSON Schema Contract

When extracting or processing AIS / Form 168 data, the JSON output must strictly match the following developer contract:

```typescript
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
```

---

## 6. Build & Test Commands

```bash
# Start local development server
npm run dev

# Validate production build (must compile with 0 errors)
npm run build

# Preview production build locally
npm run preview
```

---

## 7. Instructions for Contributing AI Agents

1. Always run `npm run build` to verify correctness before submitting changes.
2. Maintain responsive layouts: Test desktop (1920px), tablet (900px), and mobile (375px) breakpoints.
3. Ensure both Light and Dark themes look crisp and well-contrasted.
4. Keep the repository focused strictly on Indian Annual Information Statement (AIS / Form 168) and Form 26AS data.
