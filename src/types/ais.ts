/**
 * Canonical Data Model for Tax-AIS
 * Authoritative, typed contract for extracted Annual Information Statements (AIS / Form 26AS / Form 168).
 *
 * Canonical top-level structure:
 * - document : Document-level statutory metadata & regime periods
 * - partA    : Taxpayer general information
 * - partB    : Section-based tax schedules (B1, B2, B3, B4, otherSections)
 */

// ============================================================================
// 1. Extraction Statuses & Core Document Metadata
// ============================================================================

export type CanonicalExtractionStatus =
  | 'parsed'
  | 'empty'
  | 'not_found'
  | 'failed'
  | 'unsupported';

export type ExtractionStatus =
  | CanonicalExtractionStatus
  | 'extracted'
  | 'not-present';

export type AisDocumentType = 'AIS' | 'FORM_26AS' | 'FORM_168';

export type StatutoryRegime = 'ITA_1961' | 'ITA_2025';

/**
 * Period fields strictly distinguish between:
 * - ITA_1961: financialYear (e.g., "2025-26") + assessmentYear (e.g., "2026-27"). taxYear is null.
 * - ITA_2025: taxYear (e.g., "2026-27"). financialYear and assessmentYear are strictly null.
 */
export type DocumentPeriod =
  | {
      statutoryRegime: 'ITA_1961';
      financialYear: string;
      assessmentYear: string;
      taxYear: null;
    }
  | {
      statutoryRegime: 'ITA_2025';
      financialYear: null;
      assessmentYear: null;
      taxYear: string;
    };

export type DocumentMeta = {
  documentType: AisDocumentType;
  schemaVersion: string;
  extractionRulesVersion: string;
} & DocumentPeriod;

// ============================================================================
// 2. Part A - Taxpayer & General Information
// ============================================================================

export interface PartA {
  extractionStatus: ExtractionStatus;
  pan: string | null;
  maskedAadhaar: string | null;
  name: string | null;
  dateOfBirth: string | null;
  mobile: string | null;
  email: string | null;
  address: string | null;
}

// ============================================================================
// 3. Part B - Section Schedules
// ============================================================================

// --- B1: TDS / TCS Information ---
export type B1TransactionType = 'TDS' | 'TCS';
export type B1TransactionStatus = 'ACTIVE' | 'INACTIVE' | 'UNKNOWN';

export interface PartB1Transaction {
  quarter: string | null;
  date: string | null;
  amountPaidOrCredited: number;
  taxDeductedOrCollected: number;
  taxDeposited: number;
  status: B1TransactionStatus;
}

export interface PartB1Record {
  informationCode: string;
  description: string;
  sourceName: string;
  tan: string | null;
  amount: number;
  count: number;
  transactionType: B1TransactionType;
  transactions: PartB1Transaction[];
}

export interface PartB1Section {
  section: 'B1';
  category: 'TDS_TCS';
  extractionStatus: ExtractionStatus;
  records: PartB1Record[];
}

// --- B2: Specified Financial Transactions (SFT) ---
export interface PartB2Record {
  informationCode: string;
  description: string;
  reportingEntity: string;
  amount: number;
  count: number;
  transactionDate: string | null;
  status: string | null;
}

export interface PartB2Section {
  section: 'B2';
  category: 'SFT';
  extractionStatus: ExtractionStatus;
  records: PartB2Record[];
}

// --- B3: Payment of Taxes (Advance Tax / Self-Assessment) ---
export interface PartB3Record {
  financialYear: string | null;
  majorHead: string;
  minorHead: string;
  tax: number;
  surcharge: number;
  cess: number;
  other: number;
  totalAmount: number;
  bsrCode: string | null;
  depositDate: string | null;
  challanSerialNumber: string | null;
  cin: string | null;
}

export interface PartB3Section {
  section: 'B3';
  category: 'TAX_PAYMENTS';
  extractionStatus: ExtractionStatus;
  records: PartB3Record[];
}

// --- B4: Demand and Refund ---
export type B4RecordType = 'DEMAND' | 'REFUND' | 'UNKNOWN';

export interface PartB4Record {
  financialYear: string | null;
  assessmentYear: string | null;
  type: B4RecordType;
  amount: number;
  date: string | null;
  status: string | null;
}

export interface PartB4Section {
  section: 'B4';
  category: 'DEMAND_REFUND';
  extractionStatus: ExtractionStatus;
  records: PartB4Record[];
}

// --- Other Sections (B5, B6, B7, future statutory additions) ---
export interface PartBOtherRecord {
  informationCode?: string;
  description?: string;
  sourceName?: string;
  amount?: number | null;
  count?: number | null;
  date?: string | null;
  rawFields?: Record<string, string | number | null>;
}

export interface PartBOtherSection {
  section: string;
  category: string;
  extractionStatus: ExtractionStatus;
  records: PartBOtherRecord[];
}

// --- Part B Container ---
export interface PartB {
  b1: PartB1Section;
  b2: PartB2Section;
  b3: PartB3Section;
  b4: PartB4Section;
  otherSections: PartBOtherSection[];
}

// ============================================================================
// 4. Canonical Top-Level AIS Document
// ============================================================================

export interface AisDocument {
  document: DocumentMeta;
  partA: PartA;
  partB: PartB;
}

// ============================================================================
// 5. Transitional Legacy Types
// Preserved temporarily to prevent compilation breaks in downstream components
// (extractor, ITR classifier, UI) prior to their scheduled migration.
// ============================================================================

// Legacy Part A
export interface PartAGeneralInfo {
  name_of_assessee: string;
  pan: string;
  aadhaar: string;
  date_of_birth: string;
  mobile_number: string;
  email_address: string;
  address: string;
}

// Legacy Part B1
export interface PartB1LineItem {
  sr_no?: number;
  quarter: string;
  date_of_payment: string;
  amount_paid_credited: number;
  tds_deducted: number;
  tds_deposited: number;
  status: string;
}

// Legacy Part B1 Transaction
export interface PartB1TdsTcsTransaction {
  sr_no: number;
  information_code: string;
  information_description: string;
  information_source: string;
  total_amount_credited: number;
  total_amount?: number;
  line_items: PartB1LineItem[];
}

// Legacy Part B2
export interface PartB2SftTransaction {
  sr_no: number;
  information_code: string;
  information_description: string;
  information_source: string;
  amount: number;
  transaction_amount?: number;
  transaction_date: string;
}

// Legacy Part B3
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

// Legacy Part B4
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

// Legacy StatutoryPeriod
export type StatutoryPeriod =
  | {
      regime: 'ITA_1961';
      financial_year: string;
      assessment_year: string;
    }
  | {
      regime: 'ITA_2025';
      tax_year: string;
    };

export const SCHEMA_VERSION = '1.0' as const;
export const ITR_ROUTING_RULE_VERSION = 'AY2026-27.1' as const;
export const TAX_RULE_VERSION = 'AY2026-27.1' as const;

// Legacy AisDeveloperSchema
export interface AisDeveloperSchema {
  financial_year: string;
  assessment_year: string;
  tax_year?: string;
  part_a_general_info: PartAGeneralInfo;
  part_b1_tds_tcs_transactions: PartB1TdsTcsTransaction[];
  part_b2_sft_transactions: PartB2SftTransaction[];
  part_b3_tax_payments: PartB3TaxPayment[];
  part_b4_demand_refunds: PartB4DemandRefund[];
}

// Legacy ExtractionWarning
export interface ExtractionWarning {
  code: string;
  section: 'A' | 'B1' | 'B2' | 'B3' | 'B4';
  message: string;
}

// Legacy SectionStatuses
export interface SectionStatuses {
  part_a: ExtractionStatus;
  part_b1: ExtractionStatus;
  part_b2: ExtractionStatus;
  part_b3: ExtractionStatus;
  part_b4: ExtractionStatus;
  A?: ExtractionStatus;
  B1?: ExtractionStatus;
  B2?: ExtractionStatus;
  B3?: ExtractionStatus;
  B4?: ExtractionStatus;
  [key: string]: ExtractionStatus | undefined;
}

// Legacy ExtractionSection
export interface ExtractionSection<T> {
  status: ExtractionStatus;
  records: T[];
  warnings: string[];
}

// Legacy CanonicalExtractionEnvelope
export interface CanonicalExtractionEnvelope {
  schema_version: '1.0';
  document_type: 'AIS' | 'FORM_26AS';
  extraction: AisDeveloperSchema;
  section_statuses: SectionStatuses;
  warnings: ExtractionWarning[];
}

// Legacy DocumentClassification
export interface DocumentClassification {
  type: string;
  confidence: string;
  score: number;
  label: string;
  icon: string;
  themeColor: string;
}

// Legacy KeyValuePair
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

// Legacy StructuredExtractionResult
export interface StructuredExtractionResult {
  schema_version: '1.0';
  extraction_rules_version: string;
  itr_routing_rule_version: string;
  tax_rule_version: string;
  document_type: 'AIS' | 'FORM_26AS';
  extraction: AisDeveloperSchema | null;
  section_statuses: SectionStatuses;
  warnings: ExtractionWarning[];

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
  itrRecommendation?: ItrClassificationResult;
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

export type ItrFormType = 'ITR-1' | 'ITR-2' | 'ITR-3' | 'ITR-4';

export interface ItrChecklistItem {
  id: string;
  question: string;
  impactIfYes: string;
}

export interface ItrDetectedFactors {
  hasCapitalGains: boolean;
  hasPropertyTransactions: boolean;
  hasForeignRemittance: boolean;
  hasLotteryOrGambling: boolean;
  hasCryptoVda: boolean;
  hasBusinessOrProfession: boolean;
  hasSalaryIncome: boolean;
  hasInterestIncome: boolean;
  hasDividendIncome: boolean;
  hasHighCashWithdrawal: boolean;
}

export interface ItrClassificationResult {
  targetWorkspace: 'ITR-1' | 'ITR-2';
  isBarredFromItr1: boolean;
  routingTriggers: string[];
  calculatedTotalIncome: number;
  recommendedForm: ItrFormType;
  confidence: 'high' | 'provisional';
  headline: string;
  summaryReason: string;
  disqualifiersFromItr1: string[];
  eligibleFactors: string[];
  checklist: ItrChecklistItem[];
  detectedFactors: ItrDetectedFactors;
}

export type {
  TaxPositionStatus,
  RegimeTaxResult,
  CalculatorEligibility,
} from './tax';
