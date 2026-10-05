/**
 * Type definitions for Tax-AIS extraction engine
 * Matches Indian Income Tax AIS (Form 168) / Form 26AS Developer Contract
 */

export interface PartAGeneralInfo {
  name_of_assessee: string;
  pan: string;
  aadhaar: string;
  date_of_birth: string;
  mobile_number: string;
  email_address: string;
  address: string;
}

export interface PartB1LineItem {
  sr_no?: number;
  quarter: string;
  date_of_payment: string;
  amount_paid_credited: number;
  tds_deducted: number;
  tds_deposited: number;
  status: string;
}

export interface PartB1TdsTcsTransaction {
  sr_no: number;
  information_code: string;
  information_description: string;
  information_source: string;
  total_amount_credited: number;
  total_amount?: number;
  line_items: PartB1LineItem[];
}

export interface PartB2SftTransaction {
  sr_no: number;
  information_code: string;
  information_description: string;
  information_source: string;
  amount: number;
  transaction_amount?: number;
  transaction_date: string;
}

export interface PartB3TaxPayment {
  financial_year: string;
  major_head: string;
  minor_head: string;
  tax_amount: number;
  total_challan_amount: number;
  bsr_code: string;
  date_of_deposit: string;
  challan_serial_number: number;
}

export interface PartB4DemandRefund {
  sr_no?: number;
  financial_year: string;
  assessment_year?: string;
  mode: string;
  nature: string;
  nature_of_refund?: string;
  amount: number;
  refund_amount?: number;
  date: string;
  date_of_payment?: string;
  date_of_issuance?: string;
}

export interface AisDeveloperSchema {
  tax_year: string;
  part_a_general_info: PartAGeneralInfo;
  part_b1_tds_tcs_transactions: PartB1TdsTcsTransaction[];
  part_b2_sft_transactions: PartB2SftTransaction[];
  part_b3_tax_payments: PartB3TaxPayment[];
  part_b4_demand_refunds: PartB4DemandRefund[];
}

export interface DocumentClassification {
  type: string;
  confidence: string;
  score: number;
  label: string;
  icon: string;
  themeColor: string;
}

export interface KeyValuePair {
  key: string;
  value: string;
  category: string;
  confidence: number;
}

export type TableRowData = Record<string, string | number | null>;

export interface ExtractedTable {
  title: string;
  headers: string[];
  rows: TableRowData[];
}

export interface DocumentSection {
  title: string;
  content: string[];
  items?: string[];
}

export interface ExtractionMetadata {
  extractionDurationMs: number;
  characterCount: number;
  wordCount: number;
  lineCount: number;
  confidenceScore: number;
  extractedAt: string;
}

export interface StructuredExtractionResult {
  documentClassification: DocumentClassification;
  summary: {
    overview: string;
    keyHighlights: string[];
    sentiment?: string;
    completeness: string;
  };
  metadata: ExtractionMetadata;
  keyValues: Record<string, KeyValuePair[]>;
  flatKeyValues: KeyValuePair[];
  entities: {
    emails: string[];
    phones: string[];
    urls: string[];
    dates: string[];
    monetaryAmounts: string[];
    identifiers: Array<{ type: string; value: string }>;
    organizations: string[];
  };
  tables: ExtractedTable[];
  sections: DocumentSection[];
  customFieldResults: Record<string, string>;
  aisJson: AisDeveloperSchema | null;
}

export interface PdfParseProgress {
  stage: 'loading' | 'parsing' | 'extracting' | 'finishing';
  percent: number;
  message: string;
}

export interface PdfPageData {
  pageNumber: number;
  width: number;
  height: number;
  items: unknown[];
  lines: unknown[];
  text: string;
  pageObject: unknown;
  viewport: unknown;
}

export interface PdfParseResult {
  fileName: string;
  fileSize: number;
  pageCount: number;
  rawText: string;
  pages: PdfPageData[];
  metadata: Record<string, unknown>;
  pdfDoc: unknown;
}

export interface VerifiedAisContract {
  isValid: boolean;
  healthScore: number;
  hasPartA: boolean;
  hasTdsCredits: boolean;
  hasSftLedger: boolean;
  hasChallanCIN: boolean;
  hasDemandRefund: boolean;
  isPiiScrubbed: boolean;
  verifiedNodes: string[];
  missingNodes: string[];
  metrics: {
    totalGrossCredited: number;
    totalTdsDeducted: number;
    totalTdsDeposited: number;
    totalChallanPaid: number;
    totalSftVolume: number;
    totalRefundAmount: number;
  };
}

