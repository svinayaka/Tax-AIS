# Tax-AIS 🇮🇳

> **100% In-Browser Indian Income Tax Annual Information Statement (AIS) Extraction Engine & Visual Dashboard**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Design System](https://img.shields.io/badge/Design%20System-%40svinayaka%2Fsiddi--design--system-8b5cf6)](https://www.npmjs.com/package/@svinayaka/siddi-design-system)
[![PDF.js](https://img.shields.io/badge/PDF.js-Client--Side-red.svg)](https://mozilla.github.io/pdf.js/)
[![Vite](https://img.shields.io/badge/Vite-Fast%20Bundler-646CFF.svg)](https://vitejs.dev/)

**Tax-AIS** is a client-side data extraction engine that parses unstructured Indian **Annual Information Statement (AIS)** and **Form 26AS** PDF documents into cleanly structured developer-ready JSON, CSV, and interactive reconciliation dashboards.

---

## 🔒 100% Privacy Guarantee (Zero Server Uploads)

- **Pure Client-Side Processing**: All PDF parsing, regex tokenization, table grouping, and rendering run **100% locally** in the user's browser using Mozilla PDF.js.
- **No Data Leaves the Device**: No backend server, no telemetry, and zero network data transmission.
- **Safe for Sensitive Tax Data**: Fully compliant with data privacy best practices for handling PAN, Aadhaar, bank records, and financial transaction histories.

---

## ✨ Features

- **Part A (General Information)**:
  - Permanent Account Number (PAN)
  - Aadhaar Number (Masked / Full)
  - Name of Assessee
  - Date of Birth (DOB)
  - Mobile Number
  - E-mail Address
  - Complete Registered Address
- **Part B (Tax Information Breakdown)**:
  - **Part B1**: Tax Deducted or Collected at Source (TDS / TCS) grouped by Deductor Entity with nested quarterly line items (Date of Payment, Amount Paid/Credited, TDS Deducted, TDS Deposited, and Active Status).
  - **Part B2**: Specified Financial Transactions (SFT) or clean empty dataset handling.
  - **Part B3**: Tax Payments (Self-assessment & advance tax challans with Major/Minor head, BSR Code, Challan Serial Number, Deposit Date, and Amounts).
  - **Part B4**: Demand and Refund status.
- **Password-Protected AIS Support**: Built-in dialog for unlocking standard Income Tax Portal encrypted PDFs (`PAN in UPPERCASE + DOB in DDMMYYYY`).
- **Export Options**:
  - **JSON Schema**: Strict, developer-contract JSON with formatted indentation.
  - **CSV**: Spreadsheet-ready line items for CA filing and tax audit software.
  - **Markdown**: Formatted executive report for client sharing.
  - **Print / PDF**: Clean, print-styled reconciliation summary.
- **Sleek UI with Design System**:
  - Powered by `@svinayaka/siddi-design-system` design tokens (`--ksv-ds-*`).
  - Dark & Light theme toggle with local persistence.
  - Interactive PDF Canvas Viewer with Zoom and Page navigation.

---

## 📊 Developer JSON Schema Contract

```json
{
  "financial_year": "2025-26",
  "assessment_year": "2026-27",
  "part_a_general_info": {
    "name_of_assessee": "SIDDI VINAYAKA",
    "pan": "ANRPV2797D",
    "aadhaar": "XXXX XXXX 2537",
    "date_of_birth": "29/07/1988",
    "mobile_number": "9480559739",
    "email_address": "svinayaka290489@gmail.com",
    "address": "NO-189/46, 1ST FLOOR,JAMBUSAVARI DINNE,BANNERGHATTA ROAD S.O,BANGALORE SOUTH, BANGALORE,BANGALORE,560076,KARNATAKA"
  },
  "part_b1_tds_tcs_transactions": [
    {
      "sr_no": 1,
      "information_code": "TDS-393(1)[Table: S.No. 5(i)]",
      "information_description": "Interest received on securities (Section 393(1) [Table: S.No. 5(i)])",
      "information_source": "AKARA CAPITAL ADVISORS PRIVATE LIMITED (DELA43380B)",
      "total_amount_credited": 523,
      "line_items": [
        {
          "sr_no": 1,
          "quarter": "Q1(Apr-Jun)",
          "date_of_payment": "19/06/2026",
          "amount_paid_credited": 204,
          "tds_deducted": 20,
          "tds_deposited": 20,
          "status": "Active"
        }
      ]
    }
  ],
  "part_b2_sft_transactions": [],
  "part_b3_tax_payments": [
    {
      "financial_year": "2025-26",
      "major_head": "Income Tax (Other than Companies)",
      "minor_head": "Self Assessment",
      "tax_amount": 2003,
      "total_challan_amount": 2003,
      "bsr_code": "0180002",
      "date_of_deposit": "31/07/2026",
      "challan_serial_number": 27897
    }
  ],
  "part_b4_demand_refunds": []
}
```

---

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/svinayaka/Tax-AIS.git
cd Tax-AIS
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run development server
```bash
npm run dev
```
Open [http://localhost:5173/](http://localhost:5173/) in your browser.

### 4. Build for production
```bash
npm run build
```

---

## 🛠️ Tech Stack

- **Core**: Vanilla JavaScript (ES Modules) & HTML5 Canvas
- **Design Tokens**: [`@svinayaka/siddi-design-system`](https://www.npmjs.com/package/@svinayaka/siddi-design-system)
- **PDF Engine**: [`pdfjs-dist`](https://www.npmjs.com/package/pdfjs-dist)
- **Icons**: [`lucide`](https://lucide.dev/)
- **Build Tool**: [`Vite`](https://vitejs.dev/)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
