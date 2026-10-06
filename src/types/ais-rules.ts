/**
 * AIS Rule Layer Types & Contracts
 * Machine-readable document structure, section detection, and parser routing metadata.
 *
 * Invariants:
 * - Rule JSON defines document structure, labels, markers, and routing metadata.
 * - TypeScript implements parsing algorithms and data transformations.
 * - Rule configurations never contain executable code or dynamic eval constructs.
 */

import type { ExtractionStatus } from './ais';

export type AisParserId =
  | 'partA'
  | 'partB1'
  | 'partB2'
  | 'partB3'
  | 'partB4';

export interface PartAFieldRule {
  type: string;
  required: boolean;
  labels: string[];
  format?: string;
  allowDerivationFromAssessmentYear?: boolean;
  allowDerivationFromFinancialYear?: boolean;
  caseInsensitive?: boolean;
  acceptedFormats?: string[];
  multiline?: boolean;
  emptyValue?: string;
}

export interface PartASectionDetection {
  startMarkers: string[];
  endMarkers: string[];
}

export interface PartAValidationRules {
  requiredFields: string[];
  periodConsistency: {
    enabled: boolean;
    relationship: string;
  };
}

export interface PartAFailurePolicy {
  missingSectionStatus: ExtractionStatus;
  parseFailureStatus: ExtractionStatus;
  unsupportedStatus: ExtractionStatus;
  neverFabricateValues: boolean;
}

export interface AisPartARules {
  rulesetVersion: string;
  statutoryRegime: 'ITA_1961';
  part: 'A';
  periodMode: 'FY_AY';
  required: boolean;
  sectionDetection: PartASectionDetection;
  fields: Record<string, PartAFieldRule>;
  validation: PartAValidationRules;
  failurePolicy: PartAFailurePolicy;
}

export interface PartBSectionDetection {
  partMarker: string;
  sectionPattern: string;
  discoverAllNumberedSections: boolean;
  unknownSectionPolicy: string;
}

export interface PartBBoundaryRule {
  type: 'NEXT_PART_B_SECTION' | 'END_OF_DOCUMENT';
}

export interface PartB1Rules {
  parseWithinPhysicalBlockOnly: boolean;
  preserveActiveRows: boolean;
  preserveInactiveRows: boolean;
  useSummaryCountForRowAssignment: boolean;
  allowGlobalLineItemPool: boolean;
  filterInformationCodePrefixes: string[];
  allowSyntheticDeductors: boolean;
  allowSyntheticLineItems: boolean;
}

export interface PartB2Rules {
  amountRepresentsTransactionSignal: boolean;
  treatAsTaxableIncome: boolean;
  inferCapitalGain: boolean;
  inferSTCG: boolean;
  inferLTCG: boolean;
}

export interface PartB3Rules {
  allowSyntheticMajorHead: boolean;
  allowSyntheticMinorHead: boolean;
  allowWholeDocumentFallback: boolean;
}

export interface PartB4Rules {
  allowSyntheticMode: boolean;
  allowSyntheticNature: boolean;
  allowWholeDocumentFallback: boolean;
}

export type AnyPartBRules = PartB1Rules | PartB2Rules | PartB3Rules | PartB4Rules | Record<string, unknown>;

export interface PartBSectionConfig {
  name: string;
  supported: boolean;
  parser: AisParserId;
  recordsField: string;
  startMarkers: string[];
  endBoundary: PartBBoundaryRule;
  summaryFields?: string[];
  lineItemFields?: string[];
  fields?: string[];
  rules: AnyPartBRules;
}

export interface PartBUnknownSectionPolicy {
  supported: boolean;
  status: ExtractionStatus;
  preserveSectionId: boolean;
  preserveHeading: boolean;
  preserveBoundaries: boolean;
  parseTransactions: boolean;
}

export interface PartBFailurePolicy {
  sectionAbsentStatus: ExtractionStatus;
  parseFailureStatus: ExtractionStatus;
  unsupportedSectionStatus: ExtractionStatus;
  neverFabricateRecords: boolean;
  neverBorrowRowsAcrossSections: boolean;
  neverBorrowRowsAcrossEntities: boolean;
}

export interface AisPartBRules {
  rulesetVersion: string;
  statutoryRegime: 'ITA_1961';
  part: 'B';
  required: boolean;
  sectionDetection: PartBSectionDetection;
  sections: Record<string, PartBSectionConfig>;
  unknownSection: PartBUnknownSectionPolicy;
  failurePolicy: PartBFailurePolicy;
}

/**
 * Structural detection representation for physical sections discovered in text
 */
export interface DetectedAisSection {
  id: string; // e.g. 'A', 'B1', 'B2', 'B3', 'B4', 'B7'
  part: 'A' | 'B';
  sectionNumber?: number; // 1, 2, 3, 4, 7...
  rawText: string;
  startIndex: number;
  endIndex: number;
  supported: boolean;
  status: ExtractionStatus;
  parserId?: AisParserId;
  heading: string;
}

export interface AisSectionDetectionResult {
  partA: DetectedAisSection | null;
  partBSections: DetectedAisSection[];
  allDiscoveredSections: DetectedAisSection[];
}
