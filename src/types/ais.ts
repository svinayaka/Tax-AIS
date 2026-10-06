/**
 * Type definitions for Tax-AIS extraction engine
 * Matches Indian Income Tax AIS / Form 26AS Developer Contract
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

/**
 * Statutory Period & Future Form 168 Year Model
 * Under Income-tax Act, 1961 (current mode), periods are partitioned into financial_year and assessment_year.
 * Under Income-tax Act, 2025 (future mode), statutory period uses tax_year directly.
 */
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

/**
 * Canonical Developer Schema contract for AIS.
 *
 * Financial Year vs Assessment Year:
 * - financial_year: source-document financial year (e.g. "2025-26").
 * - assessment_year: corresponding filing/rule year (e.g. "2026-27").
 * - tax_year: preserved for backward compatibility and migration.
 */
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

/**
 * Extraction status indicator for individual document sections.
 * Distinguishes between successfully extracted data, sections absent from source document,
 * unsupported formats, and parser extraction failures.
 */
export type ExtractionStatus =
  | 'extracted'
  | 'not-present'
  | 'unsupported'
  | 'failed';

/**
 * Structured extraction warning emitted during section parsing.
 * Code and section identifiers allow programmatic handling without leaking sensitive PII.
 */
export interface ExtractionWarning {
  code: string;
  section: 'A' | 'B1' | 'B2' | 'B3' | 'B4';
  message: string;
}

/**
 * Authoritative machine-readable extraction statuses across AIS sections.
 */
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
}

/**
 * Section container with status, records, and parser warnings.
 */
export interface ExtractionSection<T> {
  status: ExtractionStatus;
  records: T[];
  warnings: string[];
}

/**
 * Strict canonical extraction envelope per ARCHITECTURE.md Section 14.
 */
export interface CanonicalExtractionEnvelope {
  schema_version: '1.0';
  document_type: 'AIS' | 'FORM_26AS';
  extraction: AisDeveloperSchema;
  section_statuses: SectionStatuses;
  warnings: ExtractionWarning[];
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
  schema_version: '1.0';
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

export type TaxPositionStatus = 'PAYABLE' | 'REFUND' | 'NIL';

/**
 * Tax computation result breakdown for a specific tax regime (AY 2026-27).
 * Exposes individual statutory tax components explicitly per ARCHITECTURE.md Section 10.10.
 */
export interface RegimeTaxResult {
  grossTotalIncome: number;
  taxableIncome: number;

  incomeTax: number;
  rebate87A: number;

  surchargeBeforeMarginalRelief: number;
  marginalRelief: number;
  surchargeAfterMarginalRelief: number;

  healthEducationCess: number;
  totalTaxLiability: number;

  prepaidTaxes: number;

  // Sign convention: positive indicates tax payable (due); negative indicates tax refund claimable
  netTaxPosition: number;
  netTaxStatus: TaxPositionStatus;
}

export interface CalculatorEligibility {
  supported: boolean;
  reasons: string[];
}
