/**
 * Unstructured to Structured Data Extraction Engine
 * Parses raw text streams into rich, categorized, structured JSON objects
 */

import {
  SCHEMA_VERSION,
  ITR_ROUTING_RULE_VERSION,
  TAX_RULE_VERSION
} from '../types/ais';
import type {
  StructuredExtractionResult,
  DocumentClassification,
  KeyValuePair,
  ExtractedTable,
  TableRowData,
  DocumentSection,
  AisDeveloperSchema,
  PartAGeneralInfo,
  PartB1TdsTcsTransaction,
  PartB1LineItem,
  PartB2SftTransaction,
  PartB3TaxPayment,
  PartB4DemandRefund,
  VerifiedAisContract,
  ExtractionStatus,
  ExtractionWarning,
  SectionStatuses
} from '../types/ais';
import type { DetectedAisSection } from '../types/ais-rules';
import { getAisPartARules, getAisPartBRules, getAisRulesetVersion } from './ais-rule-loader';
import { detectAisSections } from './ais-section-detector';

export function extractStructuredData(rawText: string, customFields: string[] = []): StructuredExtractionResult {
  if (!rawText || typeof rawText !== 'string') {
    return createEmptyResult();
  }

  const startTime = performance.now();
  const cleanedText = cleanText(rawText);
  const lines = cleanedText.split('\n').map(l => l.trim()).filter(Boolean);

  // 1. Classify Document Type
  const docClassification = classifyDocument(cleanedText);

  // 2. Extract Entities
  const entities = extractEntities(cleanedText);

  // 3. Extract Key-Value Pairs
  const keyValues = extractKeyValuePairs(lines);

  // 4. Extract Structured Tables / Line Items
  const tables = extractTables(cleanedText);

  // 5. Extract Hierarchical Sections
  const sections = extractSections(cleanedText);

  // 6. Generate Executive Summary
  const summary = generateSummary(docClassification, keyValues, entities);

  // 7. Process Custom Fields if user requested any
  const customFieldResults: Record<string, string> = {};
  if (customFields && customFields.length > 0) {
    customFields.forEach(field => {
      customFieldResults[field] = findCustomFieldValue(field, cleanedText, keyValues);
    });
  }

  // 8. Calculate Overall Metrics & Confidence
  const durationMs = Math.round(performance.now() - startTime);
  const confidenceScore = calculateOverallConfidence(keyValues, entities, tables);

  // 9. AIS Deterministic extraction if document matches Indian Tax AIS
  const lowerText = cleanedText.toLowerCase();
  const isForm168Future = lowerText.includes('form 168') || lowerText.includes('form no. 168') || lowerText.includes('form no 168');
  const isAis = !isForm168Future && (
    docClassification.type === 'ais' ||
    lowerText.includes('annual information statement') ||
    (lowerText.includes('assessee') && lowerText.includes('tds') && lowerText.includes('part a'))
  );

  let extraction: AisDeveloperSchema | null = null;
  let sectionStatuses: SectionStatuses = {
    part_a: 'not-present',
    part_b1: 'not-present',
    part_b2: 'not-present',
    part_b3: 'not-present',
    part_b4: 'not-present'
  };
  let warnings: ExtractionWarning[] = [];

  if (isForm168Future) {
    warnings.push({
      code: 'FORM_168_FUTURE_MODE',
      section: 'A',
      message: 'Form No. 168 under Income-tax Act, 2025 is a future statutory format and is not routed through AY 2026-27 rules.'
    });
  } else if (isAis) {
    const envelope = extractAisEnvelope(cleanedText);
    extraction = envelope.schema;
    sectionStatuses = envelope.section_statuses;
    warnings = envelope.warnings;
  }

  // Assemble full structured output
  return {
    schema_version: SCHEMA_VERSION,
    extraction_rules_version: getAisRulesetVersion(),
    itr_routing_rule_version: ITR_ROUTING_RULE_VERSION,
    tax_rule_version: TAX_RULE_VERSION,
    document_type: docClassification.type === 'form_26as' ? 'FORM_26AS' : 'AIS',
    extraction,
    section_statuses: sectionStatuses,
    warnings,
    documentClassification: docClassification,
    summary,
    metadata: {
      extractionDurationMs: durationMs,
      characterCount: rawText.length,
      wordCount: cleanedText.split(/\s+/).length,
      lineCount: lines.length,
      confidenceScore,
      extractedAt: new Date().toISOString()
    },
    keyValues: groupKeyValuesByCategory(keyValues),
    flatKeyValues: keyValues,
    entities,
    tables,
    sections,
    customFieldResults,
    aisJson: extraction
  };
}

/**
 * Clean & normalize raw extracted text
 */
function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, '    ')
    .replace(/--- Page \d+ ---/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function createEmptyResult(): StructuredExtractionResult {
  return {
    schema_version: SCHEMA_VERSION,
    extraction_rules_version: getAisRulesetVersion(),
    itr_routing_rule_version: ITR_ROUTING_RULE_VERSION,
    tax_rule_version: TAX_RULE_VERSION,
    document_type: 'AIS',
    extraction: null,
    section_statuses: {
      part_a: 'not-present',
      part_b1: 'not-present',
      part_b2: 'not-present',
      part_b3: 'not-present',
      part_b4: 'not-present'
    },
    warnings: [],
    documentClassification: {
      type: 'unknown',
      confidence: 'low',
      score: 0,
      label: 'Unknown Document',
      icon: 'file',
      themeColor: 'var(--ksv-ds-color-gray-500)'
    },
    summary: { overview: 'No readable content found in document.', keyHighlights: [], completeness: 'Incomplete' },
    metadata: { extractionDurationMs: 0, characterCount: 0, wordCount: 0, lineCount: 0, confidenceScore: 0, extractedAt: new Date().toISOString() },
    keyValues: {},
    flatKeyValues: [],
    entities: { emails: [], phones: [], urls: [], dates: [], monetaryAmounts: [], identifiers: [], organizations: [] },
    tables: [],
    sections: [],
    customFieldResults: {},
    aisJson: null
  };
}

const CLASSIFICATION_KEYWORDS: Array<{ type: string; keywords: string[]; score: number }> = [
  { type: 'form_168_future', keywords: ['form 168', 'form no. 168', 'form no 168', 'income-tax act, 2025'], score: 25 },
  { type: 'form_26as', keywords: ['form 26as', 'form no. 26as', 'annual tax statement under section 203aa'], score: 25 },
  { type: 'ais', keywords: ['annual information statement'], score: 5 },
  { type: 'ais', keywords: ['income tax department', 'income-tax department'], score: 4 },
  { type: 'ais', keywords: ['part a', 'part b'], score: 4 },
  { type: 'ais', keywords: ['tax deducted or collected at source', 'tds'], score: 3 },
  { type: 'ais', keywords: ['assessee', 'permanent account number'], score: 3 },
  { type: 'invoice', keywords: ['invoice', 'billed to', 'bill to'], score: 4 },
  { type: 'invoice', keywords: ['payment due', 'due date'], score: 3 },
  { type: 'invoice', keywords: ['subtotal', 'total due'], score: 3 },
  { type: 'resume', keywords: ['curriculum vitae', 'resume'], score: 5 },
  { type: 'resume', keywords: ['work experience', 'employment history'], score: 3 },
  { type: 'medical', keywords: ['patient name', 'lab report', 'diagnostics'], score: 4 },
  { type: 'financial', keywords: ['balance sheet', 'income statement', 'ebitda'], score: 4 }
];

function scoreDocument(lowerText: string): Record<string, number> {
  const scores: Record<string, number> = {
    form_168_future: 0,
    form_26as: 0,
    ais: 0,
    invoice: 0,
    resume: 0,
    medical: 0,
    financial: 0
  };
  for (const rule of CLASSIFICATION_KEYWORDS) {
    if (rule.keywords.some(kw => lowerText.includes(kw))) {
      scores[rule.type] = (scores[rule.type] || 0) + rule.score;
    }
  }
  return scores;
}

/**
 * Classify document using keyword clustering
 */
export function classifyDocument(text: string): DocumentClassification {
  const lower = text.toLowerCase();
  const scores = scoreDocument(lower);

  let bestType = 'general';
  let maxScore = 0;

  for (const [type, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestType = type;
    }
  }

  const typeConfig: Record<string, { title: string; icon: string; color: string }> = {
    ais: { title: 'Annual Information Statement (AIS)', icon: 'file-text', color: 'var(--ksv-ds-color-indigo-500)' },
    form_26as: { title: 'Form 26AS (Tax Credit Statement)', icon: 'file-text', color: 'var(--ksv-ds-color-sky-500)' },
    form_168_future: { title: 'Form No. 168 (Income-tax Act, 2025 - Future Mode)', icon: 'file-text', color: 'var(--ksv-ds-color-purple-500)' },
    invoice: { title: 'Invoice / Commercial Bill', icon: 'receipt', color: 'var(--ksv-ds-color-sky-500)' },
    resume: { title: 'Resume / Curriculum Vitae', icon: 'user-check', color: 'var(--ksv-ds-color-emerald-500)' },
    medical: { title: 'Clinical Diagnostic Report', icon: 'activity', color: 'var(--ksv-ds-color-rose-500)' },
    financial: { title: 'Financial Earnings Report', icon: 'trending-up', color: 'var(--ksv-ds-color-amber-500)' },
    general: { title: 'General Business Document', icon: 'file-text', color: 'var(--ksv-ds-color-violet-500)' }
  };

  let confidenceLabel = 'Estimated';
  if (maxScore >= 6) {
    confidenceLabel = 'High (95%+)';
  } else if (maxScore >= 3) {
    confidenceLabel = 'Medium (75%)';
  }

  const info = typeConfig[bestType] || typeConfig.general;
  return {
    type: bestType,
    confidence: confidenceLabel,
    score: maxScore,
    label: info.title,
    icon: info.icon,
    themeColor: info.color
  };
}

export function classifyDocumentType(text: string): string {
  return classifyDocument(text).type;
}


/**
 * Extract Core Entities (Dates, Amounts, Emails, Phones, URLs, IDs, Orgs)
 */
function extractEntities(text: string): StructuredExtractionResult['entities'] {
  const entities: StructuredExtractionResult['entities'] = {
    emails: [],
    phones: [],
    urls: [],
    dates: [],
    monetaryAmounts: [],
    identifiers: [],
    organizations: []
  };

  // 1. Emails
  const emailRegex = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi;
  const emailMatches = [...text.matchAll(emailRegex)];
  entities.emails = [...new Set(emailMatches.map(m => m[0]))];

  // 2. Phones
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  const phoneMatches = [...text.matchAll(phoneRegex)];
  entities.phones = [...new Set(phoneMatches.map(m => m[0].trim()))];

  // 3. URLs
  const urlRegex = /(https?:\/\/[^\s,]+|www\.[^\s,]+)/gi;
  const urlMatches = [...text.matchAll(urlRegex)];
  entities.urls = [...new Set(urlMatches.map(m => m[0].replace(/[,.]$/, '')))];

  // 4. Dates
  const dateRegex = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/gi;
  const dateMatches = [...text.matchAll(dateRegex)];
  entities.dates = [...new Set(dateMatches.map(m => m[0].trim()))].slice(0, 10);

  // 5. Monetary Amounts
  const moneyRegex = /[$€£¥₹]\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\b\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s?(?:USD|EUR|GBP|INR)\b/gi;
  const moneyMatches = [...text.matchAll(moneyRegex)];
  entities.monetaryAmounts = [...new Set(moneyMatches.map(m => m[0].trim()))].slice(0, 15);

  // 6. Identifiers (Invoice #, PO #, Tax ID, MRN, CIK)
  const idPatterns = [
    { label: 'Invoice #', regex: /\b(?:Invoice\s+(?:Number|#)|INV)\s*[:#]?\s*([a-z0-9-]+)/i },
    { label: 'PO #', regex: /\b(?:PO\s+(?:Number|#)|Purchase\s+Order)\s*[:#]?\s*([a-z0-9-]+)/i },
    { label: 'Tax ID / VAT', regex: /\b(?:Tax\s+ID|VAT(?:\s+Number)?|EIN)\s*[:#]?\s*([a-z0-9-]+)/i },
    { label: 'MRN', regex: /\b(?:MRN|Medical\s+Record(?:\s+#)?)\s*[:#]?\s*([a-z0-9-]+)/i },
    { label: 'Account #', regex: /\b(?:Account\s+(?:Number|#)|ACT)\s*[:#]?\s*([a-z0-9-]+)/i },
    { label: 'Report ID', regex: /\b(?:Report\s+ID|Lab\s+ID)\s*[:#]?\s*([a-z0-9-]+)/i },
    { label: 'SEC CIK', regex: /\b(?:SEC\s+CIK|CIK)\s*[:#]?\s*(\d+)/i }
  ];

  idPatterns.forEach(pattern => {
    const match = text.match(pattern.regex);
    if (match && match[1]) {
      entities.identifiers.push({
        type: pattern.label,
        value: match[1].trim()
      });
    }
  });

  return entities;
}

/**
 * Extract Key-Value pairs based on pattern heuristics
 */
function extractKeyValuePairs(lines: string[]): KeyValuePair[] {
  const kvPairs: KeyValuePair[] = [];
  const genericDelimRegex = /^([a-z0-9\s()/#_.-]{2,40})\s*[:=]\s*(.+)$/i;

  lines.forEach(line => {
    if (line.length > 180 || line.includes('|') || line.startsWith('#')) return;

    const match = line.match(genericDelimRegex);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();

      if (key && value && value.length < 150 && !key.toLowerCase().includes('http')) {
        kvPairs.push({
          key: sanitizeKey(key),
          value,
          category: categorizeKey(key),
          confidence: 90
        });
      }
    }
  });

  return kvPairs;
}

function sanitizeKey(k: string): string {
  return k.replace(/[:=]/g, '').trim();
}

function categorizeKey(k: string): string {
  const lk = k.toLowerCase();
  if (lk.includes('total') || lk.includes('amount') || lk.includes('price') || lk.includes('tax') || lk.includes('subtotal') || lk.includes('revenue')) {
    return 'Financial / Monetary';
  }
  if (lk.includes('date') || lk.includes('time') || lk.includes('period') || lk.includes('quarter') || lk.includes('fy') || lk.includes('ay')) {
    return 'Dates & Timelines';
  }
  if (lk.includes('name') || lk.includes('patient') || lk.includes('assessee') || lk.includes('pan') || lk.includes('aadhaar') || lk.includes('email') || lk.includes('phone') || lk.includes('address')) {
    return 'Identity & Assessee Profile';
  }
  if (lk.includes('id') || lk.includes('number') || lk.includes('code') || lk.includes('bsr') || lk.includes('challan') || lk.includes('cin')) {
    return 'Reference Codes & IDs';
  }
  return 'General Information';
}

function groupKeyValuesByCategory(kvs: KeyValuePair[]): Record<string, KeyValuePair[]> {
  const grouped: Record<string, KeyValuePair[]> = {};
  kvs.forEach(kv => {
    if (!grouped[kv.category]) grouped[kv.category] = [];
    grouped[kv.category].push(kv);
  });
  return grouped;
}

function isTableHeaderRow(cells: string[]): boolean {
  return cells.some(c => /^(SR\.?\s*NO|QUARTER|DATE|AMOUNT|CODE|DESCRIPTION|ITEM|TOTAL)/i.test(c));
}

function parseTableRow(headers: string[], cells: string[]): TableRowData {
  const rowObj: TableRowData = {};
  headers.forEach((h, colIdx) => {
    let propKey = h.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    while (propKey.startsWith('_')) {
      propKey = propKey.slice(1);
    }
    while (propKey.endsWith('_')) {
      propKey = propKey.slice(0, -1);
    }
    rowObj[propKey] = cells[colIdx] || '';
  });
  return rowObj;
}

function getTableTitle(lines: string[], index: number, fallbackCount: number): string {
  if (index > 0 && lines[index - 1].length < 60 && !lines[index - 1].includes('|')) {
    return lines[index - 1];
  }
  return `Table ${fallbackCount}`;
}

/**
 * Extract Pipe-delimited or Structured Tabular Data
 */
function extractTables(text: string): ExtractedTable[] {
  const tables: ExtractedTable[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let currentHeaders: string[] = [];
  let currentRows: TableRowData[] = [];
  let tableTitle = 'Extracted Table';

  const flushTable = () => {
    if (currentHeaders.length > 0 && currentRows.length > 0) {
      tables.push({ title: tableTitle, headers: currentHeaders, rows: currentRows });
      currentHeaders = [];
      currentRows = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!line.includes('|')) {
      flushTable();
      continue;
    }

    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length < 3) continue;

    if (isTableHeaderRow(cells)) {
      flushTable();
      currentHeaders = cells;
      tableTitle = getTableTitle(lines, i, tables.length + 1);
    } else if (currentHeaders.length > 0 && cells.length >= Math.min(3, currentHeaders.length - 1)) {
      currentRows.push(parseTableRow(currentHeaders, cells));
    }
  }

  flushTable();
  return tables;
}


/**
 * Extract Hierarchical Sections
 */
function extractSections(text: string): DocumentSection[] {
  const sections: DocumentSection[] = [];
  const lines = text.split('\n');

  let currentTitle = 'Overview';
  let currentContent: string[] = [];

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    if (/^(?:Part\s+[a-z0-9]+|Section\s+\d+|[a-z\s]{4,30}:?$)/i.test(trimmed) && trimmed.length < 50 && !trimmed.includes('|')) {
      if (currentContent.length > 0) {
        sections.push({ title: currentTitle, content: currentContent });
      }
      currentTitle = trimmed.replace(/:$/, '');
      currentContent = [];
    } else {
      currentContent.push(trimmed);
    }
  });

  if (currentContent.length > 0) {
    sections.push({ title: currentTitle, content: currentContent });
  }

  return sections.slice(0, 8);
}

/**
 * Generate Summary based on extracted metadata
 */
function generateSummary(
  docClassification: DocumentClassification,
  keyValues: KeyValuePair[],
  entities: StructuredExtractionResult['entities']
) {
  let overview = `Extracted ${docClassification.label} containing ${keyValues.length} key fields, ${entities.monetaryAmounts.length} monetary figures, and ${entities.dates.length} timeline milestones.`;

  if (docClassification.type === 'ais') {
    overview = `Official Indian Income Tax Annual Information Statement (AIS). Details assessee profile (Part A) and tax deducted, SFT, and challan payments (Part B).`;
  } else if (docClassification.type === 'form_26as') {
    overview = `Official Indian Income Tax Form 26AS Tax Credit Statement. Details tax deducted at source, tax collected, and advance tax payments.`;
  } else if (docClassification.type === 'form_168_future') {
    overview = `Form No. 168 under Income-tax Act, 2025 (Future Mode).`;
  } else if (docClassification.type === 'invoice') {
    overview = `Commercial invoice document detailing billing breakdown, line items, and transaction balance.`;
  }

  const highlights: string[] = [];
  if (entities.identifiers.length > 0) {
    highlights.push('Reference IDs: ' + entities.identifiers.map(i => i.type + ': ' + i.value).join(', '));
  }
  if (entities.monetaryAmounts.length > 0) highlights.push(`Monetary Figures: ${entities.monetaryAmounts.slice(0, 3).join(', ')}`);
  if (entities.dates.length > 0) highlights.push(`Key Dates: ${entities.dates.slice(0, 3).join(', ')}`);

  return {
    overview,
    keyHighlights: highlights,
    completeness: keyValues.length > 5 ? 'High Completeness' : 'Partial'
  };
}

function calculateOverallConfidence(keyValues: KeyValuePair[], entities: StructuredExtractionResult['entities'], tables: ExtractedTable[]): number {
  let score = 70;
  if (keyValues.length > 5) score += 10;
  if (entities.monetaryAmounts.length > 0 || entities.dates.length > 0) score += 10;
  if (tables.length > 0) score += 10;
  return Math.min(score, 99);
}

function findCustomFieldValue(field: string, text: string, keyValues: KeyValuePair[]): string {
  const match = keyValues.find(kv => kv.key.toLowerCase().includes(field.toLowerCase()));
  if (match) return match.value;

  const regex = new RegExp(`${field}\\s*[:=]\\s*([^\\n]+)`, 'i');
  const textMatch = text.match(regex);
  return textMatch ? textMatch[1].trim() : 'Not Found';
}

// ==========================================================================
// Specialized AIS Deterministic Parser & Sanitizer (Income-tax Act, 1961)
// ==========================================================================

function parseNum(val: unknown): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const cleanStr = String(val).replace(/[₹,Rs.\s]/gi, '').trim();
  const parsed = Number.parseFloat(cleanStr);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeYearRange(raw: string): string {
  const m = raw.trim().match(/^(\d{4})-(\d{2,4})$/);
  if (!m) return '';
  const start = m[1];
  const end = m[2].length === 4 ? m[2].slice(2) : m[2];
  return `${start}-${end}`;
}

export function deriveAyFromFy(fy: string): string {
  const m = fy.trim().match(/^(\d{4})-(\d{2})$/);
  if (!m) return '';
  const start = Number.parseInt(m[1], 10);
  const ayStart = start + 1;
  const ayEnd = (start + 2) % 100;
  return `${ayStart}-${String(ayEnd).padStart(2, '0')}`;
}

export function deriveFyFromAy(ay: string): string {
  const m = ay.trim().match(/^(\d{4})-(\d{2})$/);
  if (!m) return '';
  const start = Number.parseInt(m[1], 10);
  const fyStart = start - 1;
  const fyEnd = start % 100;
  return `${fyStart}-${String(fyEnd).padStart(2, '0')}`;
}

export function extractFinancialYear(text: string): string {
  const match = text.match(/(?<!(?:for|from)\s+)(?:financial\s+year|f\.?y\.?)\s*[:=-]?\s*(\d{4}-\d{2,4})/i);
  if (!match) return '';
  return normalizeYearRange(match[1]);
}

export function extractAssessmentYear(text: string): string {
  const match = text.match(/(?:assessment\s+year|a\.?y\.?)\s*[:=-]?\s*(\d{4}-\d{2,4})/i);
  if (!match) return '';
  return normalizeYearRange(match[1]);
}

interface ResolvedPeriodYears {
  fy: string;
  ay: string;
}

function resolveRawPeriodYears(text: string): ResolvedPeriodYears {
  const fy = extractFinancialYear(text);
  const ay = extractAssessmentYear(text);
  return { fy, ay };
}

function validateAndDerivePeriod(
  period: ResolvedPeriodYears,
  warnings: ExtractionWarning[]
): { financial_year: string; assessment_year: string } {
  let { fy, ay } = period;

  if (fy && ay) {
    const expectedAy = deriveAyFromFy(fy);
    if (expectedAy && expectedAy !== ay) {
      warnings.push({
        code: 'PERIOD_AMBIGUOUS',
        section: 'A',
        message: 'Discrepancy detected between extracted Financial Year and Assessment Year.'
      });
    }
    return { financial_year: fy, assessment_year: ay };
  }

  if (fy && !ay) {
    ay = deriveAyFromFy(fy);
    if (!ay) {
      warnings.push({
        code: 'PERIOD_AMBIGUOUS',
        section: 'A',
        message: 'Could not deterministically derive Assessment Year from Financial Year.'
      });
    }
    return { financial_year: fy, assessment_year: ay };
  }

  if (!fy && ay) {
    fy = deriveFyFromAy(ay);
    if (!fy) {
      warnings.push({
        code: 'PERIOD_AMBIGUOUS',
        section: 'A',
        message: 'Could not deterministically derive Financial Year from Assessment Year.'
      });
    }
    return { financial_year: fy, assessment_year: ay };
  }

  warnings.push({
    code: 'PERIOD_NOT_FOUND',
    section: 'A',
    message: 'Neither Financial Year nor Assessment Year could be identified in the document.'
  });
  return { financial_year: '', assessment_year: '' };
}

export function extractStatutoryPeriod(text: string): {
  financial_year: string;
  assessment_year: string;
  warnings: ExtractionWarning[];
} {
  const warnings: ExtractionWarning[] = [];
  const rawYears = resolveRawPeriodYears(text);
  const derived = validateAndDerivePeriod(rawYears, warnings);

  return {
    financial_year: derived.financial_year,
    assessment_year: derived.assessment_year,
    warnings
  };
}

export function extractTaxYear(text: string): string {
  const period = extractStatutoryPeriod(text);
  return period.assessment_year || period.financial_year || '';
}

function extractPartAGeneralInfo(text: string): PartAGeneralInfo {
  const panMatch = text.match(/\b([a-z]{5}\d{4}[a-z])\b/i) ?? 
                   text.match(/(?:Permanent\s+Account\s+Number\s*\(PAN\)|PAN)\s*[:=-]?\s*([a-z]{5}\d{4}[a-z])/i);
  const pan = panMatch ? panMatch[1].toUpperCase() : '';

  const aadhaarMatch = text.match(/(?:Aadhaar\s+Number|Aadhaar)\s*[:=-]?\s*([x0-9]{4}\s+[x0-9]{4}\s+\d{4})/i) ??
                       text.match(/\b([x0-9]{4}\s+[x0-9]{4}\s+\d{4})\b/i);
  const aadhaar = aadhaarMatch ? aadhaarMatch[1].trim() : '';

  let name = '';
  const nameLabelMatch = text.match(/Name\s+of\s+Assessee\s*[:=-]?\s*([a-z\s.]+?)(?:Date\s+of\s+Birth|Mobile|E-mail|Address|\n|$)/i);
  if (nameLabelMatch && nameLabelMatch[1].trim().length > 2 && !nameLabelMatch[1].toLowerCase().includes('aadhaar')) {
    name = nameLabelMatch[1].trim();
  } else {
    const seqMatch = text.match(/[a-z]{5}\d{4}[a-z]\s+[x0-9\s]{12,14}\s+([a-z\s]{3,40}?)(?=\s+Date\s+of\s+Birth|\s+\d{2}\/\d{2}\/\d{4}|\s+\d{10})/i);
    if (seqMatch) name = seqMatch[1].trim();
  }
  if (!name) {
    const afterAadhaar = text.match(/xxxx\s+xxxx\s+\d{4}\s+([a-z\s]{3,35})/i);
    if (afterAadhaar) name = afterAadhaar[1].trim();
  }
  const nameOfAssessee = name || '';

  const dobMatch = text.match(/(?:Date\s+of\s+Birth|DOB)\s*[:=-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i) ??
                   text.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
  const dateOfBirth = dobMatch ? dobMatch[1].trim() : '';

  const mobileMatch = text.match(/(?:Mobile\s+Number|Mobile|Phone)\s*[:=-]?\s*([6-9]\d{9})/i) ??
                      text.match(/\b([6-9]\d{9})\b/);
  const mobileNumber = mobileMatch ? mobileMatch[1].trim() : '';

  const emailMatch = text.match(/([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i);
  const emailAddress = emailMatch ? emailMatch[1].trim() : '';

  let address = '';
  const addrMatch = text.match(/Address\s*[:=-]?\s*([a-z0-9\s,./-]+?)(?=-{5,}|Annual\s+Information\s+Statement|Part\s+B|\n\s*\n|$)/i);
  if (addrMatch) {
    address = addrMatch[1].replace(/[-_]{5,}/g, '').trim();
  }

  return {
    name_of_assessee: nameOfAssessee,
    pan,
    aadhaar,
    date_of_birth: dateOfBirth,
    mobile_number: mobileNumber,
    email_address: emailAddress,
    address
  };
}

function cleanCodeAndDesc(rawCode: string, rawDesc: string): { code: string; desc: string } {
  const combined = `${rawCode} ${rawDesc}`.replace(/\s+/g, ' ').trim();
  let code: string;
  let desc: string;

  const codeMatch = combined.match(/^(T(?:DS|CS)-[0-9a-z()]+(?:\[Table:[^\]]+\])?)/i);
  if (codeMatch) {
    code = codeMatch[1];
    desc = combined.slice(codeMatch[0].length).replace(/^[^\w(]+/, '').trim();
  } else {
    code = rawCode.trim();
    desc = rawDesc.trim();
  }

  if (desc.includes('[Table:') && !desc.includes('])')) {
    desc = desc.replace(/\[Table:.*$/, '').trim();
  }
  if ((desc.match(/\(/g) || []).length > (desc.match(/\)/g) || []).length) {
    desc += ')';
  }
  if (!desc) {
    desc = 'Tax Deducted at Source / Securities Interest';
  }

  return { code, desc };
}

function parseRegexLineItems(text: string): PartB1LineItem[] {
  const allLineItems: PartB1LineItem[] = [];
  const lineItemRegex = /(?:(\d+)\s+)?(Q[1-4](?:\s*\([^)]+\))?)\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)(?:\s+([a-z0-9_-]+))?/gi;
  let lineMatch: RegExpExecArray | null;

  while ((lineMatch = lineItemRegex.exec(text)) !== null) {
    allLineItems.push({
      sr_no: lineMatch[1] ? Number.parseInt(lineMatch[1], 10) : (allLineItems.length + 1),
      quarter: lineMatch[2].trim(),
      date_of_payment: lineMatch[3].trim(),
      amount_paid_credited: parseNum(lineMatch[4]),
      tds_deducted: parseNum(lineMatch[5]),
      tds_deposited: parseNum(lineMatch[6]),
      status: lineMatch[7] ? lineMatch[7].trim() : 'Active'
    });
  }
  return allLineItems;
}

function parsePipeLineItems(lines: string[]): PartB1LineItem[] {
  const allLineItems: PartB1LineItem[] = [];
  lines.forEach(line => {
    if (line.includes('|') && /Q[1-4]/i.test(line) && /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(line)) {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 6 && !parts[0].toLowerCase().includes('sr')) {
        allLineItems.push({
          sr_no: allLineItems.length + 1,
          quarter: parts[1] || 'Q1',
          date_of_payment: parts[2] || '',
          amount_paid_credited: parseNum(parts[3]),
          tds_deducted: parseNum(parts[4]),
          tds_deposited: parseNum(parts[5]),
          status: parts[6] || 'Active'
        });
      }
    }
  });
  return allLineItems;
}

function isDeductorPipeSummaryLine(line: string): boolean {
  if (!line.includes('|')) return false;
  const lower = line.toLowerCase();
  if (lower.includes('sr') || lower.includes('information code')) return false;
  return line.includes('TDS-') || line.includes('TCS-') || line.includes('Sec 19') || /\([a-z]{4}\d{5}[a-z]\)/i.test(line);
}

function extractDeductorsFromPipes(lines: string[], warnings: ExtractionWarning[]): PartB1TdsTcsTransaction[] {
  const partB1: PartB1TdsTcsTransaction[] = [];
  const summaryLineIndices: number[] = [];

  lines.forEach((line, idx) => {
    if (isDeductorPipeSummaryLine(line)) {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 6) {
        summaryLineIndices.push(idx);
      }
    }
  });

  if (summaryLineIndices.length === 0) {
    return partB1;
  }

  summaryLineIndices.forEach((lineIdx, i) => {
    const parts = lines[lineIdx].split('|').map(p => p.trim());
    const { code, desc } = cleanCodeAndDesc(parts[1], parts[2]);
    if (code.toUpperCase().startsWith('TDS-ANN')) {
      return;
    }

    const nextLineIdx = i + 1 < summaryLineIndices.length ? summaryLineIndices[i + 1] : lines.length;
    const blockLines = lines.slice(lineIdx + 1, nextLineIdx);

    const deductorLineItems = parsePipeLineItems(blockLines);
    if (deductorLineItems.length === 0) {
      warnings.push({
        code: 'B1_SUMMARY_WITHOUT_DETAILS',
        section: 'B1',
        message: 'Deductor summary record found without parseable detail rows.'
      });
    }

    partB1.push({
      sr_no: Number.parseInt(parts[0], 10) || (partB1.length + 1),
      information_code: code,
      information_description: desc,
      information_source: parts[3] || '',
      total_amount_credited: parseNum(parts[5]) || deductorLineItems.reduce((acc, l) => acc + l.amount_paid_credited, 0),
      line_items: deductorLineItems
    });
  });

  return partB1;
}

function extractDeductorsFromRegex(text: string, warnings: ExtractionWarning[]): PartB1TdsTcsTransaction[] {
  const partB1: PartB1TdsTcsTransaction[] = [];
  const deductorBlockRegex = /(?:(\d+)\s+)?(T[DC]S-[^\s]+)\s+([a-z0-9\s()/:.[\]-]{2,120}?)\s+([a-z0-9\s.,&/-]+?\((?:[a-z]{4}\d{5}[a-z])\))\s+(\d+)\s+([\d,.]+)/gi;
  const matches = [...text.matchAll(deductorBlockRegex)];

  if (matches.length === 0) {
    return partB1;
  }

  matches.forEach((dMatch, idx) => {
    const { code, desc } = cleanCodeAndDesc(dMatch[2], dMatch[3]);
    if (code.toUpperCase().startsWith('TDS-ANN')) {
      return;
    }

    const matchEnd = (dMatch.index ?? 0) + dMatch[0].length;
    const nextMatchStart = idx + 1 < matches.length ? (matches[idx + 1].index ?? text.length) : text.length;
    const blockText = text.slice(matchEnd, nextMatchStart);

    const deductorLineItems = parseRegexLineItems(blockText);
    if (deductorLineItems.length === 0) {
      warnings.push({
        code: 'B1_SUMMARY_WITHOUT_DETAILS',
        section: 'B1',
        message: 'Deductor summary record found without parseable detail rows.'
      });
    }

    partB1.push({
      sr_no: dMatch[1] ? Number.parseInt(dMatch[1], 10) : (partB1.length + 1),
      information_code: code,
      information_description: desc,
      information_source: dMatch[4].trim(),
      total_amount_credited: parseNum(dMatch[6]) || deductorLineItems.reduce((acc, l) => acc + l.amount_paid_credited, 0),
      line_items: deductorLineItems
    });
  });

  return partB1;
}

export function extractPartB1Section(text: string): string {
  const startMatch = /Part\s+B1[\s-]*Information\s+relating\s+to\s+tax\s+deducted\s+or\s+collected\s+at\s+source/i.exec(text)
    ?? /Part\s+B1\b/i.exec(text);

  if (!startMatch) {
    return '';
  }

  const start = startMatch.index;
  const remaining = text.slice(start);

  const afterHeader = remaining.slice(startMatch[0].length);
  const endMatch = /Part\s+B[2-9][\s-]*Information/i.exec(afterHeader)
    ?? /Part\s+B[2-9]\b/i.exec(afterHeader);

  if (!endMatch) {
    return remaining;
  }

  return remaining.slice(0, startMatch[0].length + endMatch.index);
}

export function extractPartB1Transactions(
  text: string,
  _lines: string[] = [],
  warnings: ExtractionWarning[] = []
): { transactions: PartB1TdsTcsTransaction[]; status: ExtractionStatus } {
  const scopedText = extractPartB1Section(text);
  if (!scopedText) {
    warnings.push({
      code: 'B1_SECTION_NOT_FOUND',
      section: 'B1',
      message: 'Part B1 section boundary could not be established.'
    });
    return { transactions: [], status: 'not-present' };
  }

  const scopedLines = scopedText.split('\n').map(l => l.trim()).filter(Boolean);

  let partB1 = extractDeductorsFromPipes(scopedLines, warnings);
  if (partB1.length === 0) {
    partB1 = extractDeductorsFromRegex(scopedText, warnings);
  }

  // Filter out any TDS-ANN summaries defensive check
  partB1 = partB1.filter(txn => !txn.information_code.trim().toUpperCase().startsWith('TDS-ANN'));

  if (partB1.length === 0) {
    warnings.push({
      code: 'B1_BLOCK_PARSE_FAILED',
      section: 'B1',
      message: 'Part B1 section found but deductor records could not be parsed.'
    });
    return { transactions: [], status: 'failed' };
  }

  return { transactions: partB1, status: 'extracted' };
}

export function extractPartB2Section(text: string): string {
  const startMatch = /Part\s+B2[\s-]*Information\s+relating\s+to\s+specified\s+financial\s+transaction/i.exec(text)
    ?? /Part\s+B2\b/i.exec(text);

  if (!startMatch) {
    return '';
  }

  const start = startMatch.index;
  const remaining = text.slice(start);
  const afterHeader = remaining.slice(startMatch[0].length);
  const endMatch = /Part\s+B[13-9][\s-]*Information/i.exec(afterHeader)
    ?? /Part\s+B[13-9]\b/i.exec(afterHeader);

  if (!endMatch) {
    return remaining;
  }

  return remaining.slice(0, startMatch[0].length + endMatch.index);
}

export function extractPartB3Section(text: string): string {
  const startMatch = /Part\s+B3[\s-]*Information\s+relating\s+to\s+payment\s+of\s+taxes/i.exec(text)
    ?? /Part\s+B3\b/i.exec(text);

  if (!startMatch) {
    return '';
  }

  const start = startMatch.index;
  const remaining = text.slice(start);
  const afterHeader = remaining.slice(startMatch[0].length);
  const endMatch = /Part\s+B[124-9][\s-]*Information/i.exec(afterHeader)
    ?? /Part\s+B[124-9]\b/i.exec(afterHeader);

  if (!endMatch) {
    return remaining;
  }

  return remaining.slice(0, startMatch[0].length + endMatch.index);
}

export function extractPartB4Section(text: string): string {
  const startMatch = /Part\s+B4[\s-]*Information\s+relating\s+to\s+demand\s+and\s+refund/i.exec(text)
    ?? /Part\s+B4\b/i.exec(text);

  if (!startMatch) {
    return '';
  }

  const start = startMatch.index;
  const remaining = text.slice(start);
  const afterHeader = remaining.slice(startMatch[0].length);
  const endMatch = /Part\s+B[1-35-9][\s-]*Information/i.exec(afterHeader)
    ?? /Part\s+B[1-35-9]\b/i.exec(afterHeader);

  if (!endMatch) {
    return remaining;
  }

  return remaining.slice(0, startMatch[0].length + endMatch.index);
}

function findDateInSubsequentLines(lines: string[], startIndex: number): string {
  for (let j = startIndex; j < lines.length; j++) {
    if (/^(?:\d+\s+)?sft-[a-z0-9_.-]+/i.test(lines[j])) {
      break;
    }
    const dateMatch = lines[j].match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/);
    if (dateMatch) {
      return dateMatch[1];
    }
  }
  return '';
}

export function extractPartB2SftTransactions(
  text: string,
  _warnings: ExtractionWarning[] = []
): { transactions: PartB2SftTransaction[]; status: ExtractionStatus } {
  const scopedText = extractPartB2Section(text);
  if (!scopedText) {
    return { transactions: [], status: 'not-present' };
  }

  const partB2: PartB2SftTransaction[] = [];
  const lines = scopedText.split('\n').map(l => l.trim()).filter(Boolean);

  const sftSummaryRegex = /^(?:(\d+)\s+)?(SFT-[a-z0-9_.-]+)\s+([a-z0-9\s()/-]{2,100}?)\s+([a-z0-9\s.,&/()_-]+?\([a-z0-9._-]+\)|[a-z0-9\s.,&/_-]{2,80})\s+(\d+)\s+([\d,.]+)$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(sftSummaryRegex);
    if (match) {
      const code = match[2].trim();
      const desc = match[3].trim();
      const source = match[4].trim();
      const amount = parseNum(match[6]);
      const txDate = findDateInSubsequentLines(lines, i + 1);

      partB2.push({
        sr_no: partB2.length + 1,
        information_code: code,
        information_description: desc,
        information_source: source,
        amount,
        transaction_date: txDate
      });
    }
  }

  if (partB2.length === 0) {
    lines.forEach(line => {
      if (line.includes('|') && line.includes('SFT-')) {
        const parts = line.split('|').map(p => p.trim());
        if (parts.length >= 5 && !parts[0].toLowerCase().includes('sr')) {
          partB2.push({
            sr_no: Number.parseInt(parts[0], 10) || (partB2.length + 1),
            information_code: parts[1] || '',
            information_description: parts[2] || '',
            information_source: parts[3] || '',
            amount: parseNum(parts[4]),
            transaction_date: parts[5] || ''
          });
        }
      }
    });
  }

  const status: ExtractionStatus = partB2.length > 0 ? 'extracted' : 'not-present';
  return { transactions: partB2, status };
}

function parseTaxPaymentMajorHead(rawHead: string): string {
  const cleaned = rawHead.replace(/\s+/g, ' ').trim();
  const lower = cleaned.toLowerCase();
  if (lower.includes('income tax (other than companies)')) return 'Income Tax (Other than Companies)';
  if (lower.includes('income tax')) return 'Income Tax';
  return cleaned;
}

function parseTaxPaymentMinorHead(rawHead: string): string {
  const normalized = rawHead.replace(/\s+/g, ' ').trim();
  const lower = normalized.toLowerCase();
  if (lower.includes('advance')) return 'Advance Tax';
  if (lower.includes('regular')) return 'Regular Assessment';
  if (lower.includes('self assessment') || lower.includes('self-assessment')) return 'Self Assessment';
  return normalized;
}

function extractTaxPaymentsFromPipes(lines: string[]): PartB3TaxPayment[] {
  const partB3: PartB3TaxPayment[] = [];
  lines.forEach(line => {
    if (line.includes('|') && (line.toLowerCase().includes('income tax') || line.toLowerCase().includes('assessment') || /\d{7}/.test(line))) {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 8 && !parts[0].toLowerCase().includes('sr') && !parts[1].toLowerCase().includes('financial year')) {
        partB3.push({
          financial_year: parts[1] || '',
          major_head: parseTaxPaymentMajorHead(parts[2] || ''),
          minor_head: parseTaxPaymentMinorHead(parts[3] || ''),
          tax_amount: parseNum(parts[4]),
          total_challan_amount: parseNum(parts[8] || parts[4]),
          bsr_code: parts[9] || '',
          date_of_deposit: parts[10] || '',
          challan_serial_number: Number.parseInt(parts[11], 10) || 0
        });
      }
    }
  });
  return partB3;
}

function extractTaxPaymentsFromRegex(text: string): PartB3TaxPayment[] {
  const partB3: PartB3TaxPayment[] = [];
  const b3Regex = /(?:(\d+)\s+)?(\d{4}-\d{2})\s+([a-z\s()]+?)\s+([\d,.]+)(?:\s+[\d,.]+){1,5}\s+([\d,.]+)\s+(\d{7})\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+(\d{4,7})(?:\s+([a-z0-9]+))?/gi;
  let b3Match: RegExpExecArray | null;
  while ((b3Match = b3Regex.exec(text)) !== null) {
    partB3.push({
      financial_year: b3Match[2],
      major_head: parseTaxPaymentMajorHead(b3Match[3] || ''),
      minor_head: parseTaxPaymentMinorHead(b3Match[3] || ''),
      tax_amount: parseNum(b3Match[4]),
      total_challan_amount: parseNum(b3Match[5]),
      bsr_code: b3Match[6],
      date_of_deposit: b3Match[7],
      challan_serial_number: Number.parseInt(b3Match[8], 10) || 0
    });
  }
  return partB3;
}

export function extractPartB3TaxPayments(
  text: string,
  _warnings: ExtractionWarning[] = []
): { payments: PartB3TaxPayment[]; status: ExtractionStatus } {
  const scopedText = extractPartB3Section(text);
  if (!scopedText) {
    return { payments: [], status: 'not-present' };
  }

  const scopedLines = scopedText.split('\n').map(l => l.trim()).filter(Boolean);
  let payments = extractTaxPaymentsFromPipes(scopedLines);
  if (payments.length === 0) {
    payments = extractTaxPaymentsFromRegex(scopedText);
  }

  const status: ExtractionStatus = payments.length > 0 ? 'extracted' : 'not-present';
  return { payments, status };
}

export function extractPartB4DemandRefunds(
  text: string,
  _warnings: ExtractionWarning[] = []
): { refunds: PartB4DemandRefund[]; status: ExtractionStatus } {
  const scopedText = extractPartB4Section(text);
  if (!scopedText) {
    return { refunds: [], status: 'not-present' };
  }

  const partB4: PartB4DemandRefund[] = [];
  const drRegex = /(?:^|\n)\s*(?:\d+\s+)?(\d{4}-\d{2})\s+([a-z0-9\s()/-]{2,40}?)\s+([a-z0-9\s()/-]{2,80}?)\s+([\d,.]+)\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/gi;
  let match: RegExpExecArray | null;
  while ((match = drRegex.exec(scopedText)) !== null) {
    partB4.push({
      sr_no: partB4.length + 1,
      financial_year: match[1].trim(),
      mode: match[2].trim(),
      nature: match[3].trim(),
      amount: parseNum(match[4]),
      date: match[5].trim()
    });
  }

  if (partB4.length === 0) {
    const lines = scopedText.split('\n').map(l => l.trim()).filter(Boolean);
    lines.forEach(line => {
      if (line.includes('|') && (line.toLowerCase().includes('refund') || line.toLowerCase().includes('demand'))) {
        const parts = line.split('|').map(p => p.trim());
        if (parts.length >= 5 && !parts[0].toLowerCase().includes('sr') && /\d{4}-\d{2}/.test(parts[1])) {
          partB4.push({
            sr_no: Number.parseInt(parts[0], 10) || (partB4.length + 1),
            financial_year: parts[1] || '',
            mode: parts[2] || '',
            nature: parts[3] || '',
            amount: parseNum(parts[4]),
            date: parts[5] || ''
          });
        }
      }
    });
  }

  const status: ExtractionStatus = partB4.length > 0 ? 'extracted' : 'not-present';
  return { refunds: partB4, status };
}

/**
 * Static Parser Registry
 * Maps declarative parser IDs from AIS rule JSON to pure TypeScript extraction functions.
 * Rule JSON may reference parser IDs only; dynamic execution or eval is strictly prohibited.
 */
export const AIS_PARSER_REGISTRY = {
  partA: (sectionText: string): PartAGeneralInfo => extractPartAGeneralInfo(sectionText),
  partB1: (
    sectionText: string,
    lines: string[],
    warnings: ExtractionWarning[]
  ): { transactions: PartB1TdsTcsTransaction[]; status: ExtractionStatus } =>
    extractPartB1Transactions(sectionText, lines, warnings),
  partB2: (
    sectionText: string,
    _lines: string[],
    warnings: ExtractionWarning[]
  ): { transactions: PartB2SftTransaction[]; status: ExtractionStatus } =>
    extractPartB2SftTransactions(sectionText, warnings),
  partB3: (
    sectionText: string,
    _lines: string[],
    warnings: ExtractionWarning[]
  ): { payments: PartB3TaxPayment[]; status: ExtractionStatus } =>
    extractPartB3TaxPayments(sectionText, warnings),
  partB4: (
    sectionText: string,
    _lines: string[],
    warnings: ExtractionWarning[]
  ): { refunds: PartB4DemandRefund[]; status: ExtractionStatus } =>
    extractPartB4DemandRefunds(sectionText, warnings)
} as const;

export function extractAisEnvelope(rawText: string): {
  schema: AisDeveloperSchema;
  section_statuses: SectionStatuses;
  warnings: ExtractionWarning[];
} {
  const text = cleanText(rawText || '');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const partARules = getAisPartARules();
  const partBRules = getAisPartBRules();

  const periodRes = extractStatutoryPeriod(text);
  const warnings: ExtractionWarning[] = [...periodRes.warnings];

  // 1. Detect physical sections according to rule declarations
  const detected = detectAisSections(text, partARules, partBRules);

  // 2. Dispatch Part A through registry
  const partAText = detected.partA ? detected.partA.rawText : text;
  const partA = AIS_PARSER_REGISTRY.partA(partAText);
  const isPartAPresent = Boolean(partA.pan || partA.name_of_assessee);
  const partAStatus: ExtractionStatus = isPartAPresent ? 'extracted' : 'not-present';

  // 3. Dispatch discovered Part B sections through registry
  const partBMap = new Map<string, DetectedAisSection>();
  for (const sec of detected.partBSections) {
    partBMap.set(sec.id, sec);
  }

  const b1Section = partBMap.get('B1');
  const b1Text = b1Section ? b1Section.rawText : text;
  const b1Res = AIS_PARSER_REGISTRY.partB1(b1Text, lines, warnings);

  const b2Section = partBMap.get('B2');
  const b2Text = b2Section ? b2Section.rawText : text;
  const b2Res = AIS_PARSER_REGISTRY.partB2(b2Text, lines, warnings);

  const b3Section = partBMap.get('B3');
  const b3Text = b3Section ? b3Section.rawText : text;
  const b3Res = AIS_PARSER_REGISTRY.partB3(b3Text, lines, warnings);

  const b4Section = partBMap.get('B4');
  const b4Text = b4Section ? b4Section.rawText : text;
  const b4Res = AIS_PARSER_REGISTRY.partB4(b4Text, lines, warnings);

  const section_statuses: SectionStatuses = {
    part_a: partAStatus,
    part_b1: b1Res.status,
    part_b2: b2Res.status,
    part_b3: b3Res.status,
    part_b4: b4Res.status,
    A: partAStatus,
    B1: b1Res.status,
    B2: b2Res.status,
    B3: b3Res.status,
    B4: b4Res.status
  };

  // Preserve discovered unknown/unsupported numbered sections in section_statuses
  for (const sec of detected.partBSections) {
    if (!sec.supported) {
      section_statuses[sec.id] = 'unsupported';
    }
  }

  const schema: AisDeveloperSchema = {
    financial_year: periodRes.financial_year,
    assessment_year: periodRes.assessment_year,
    tax_year: periodRes.assessment_year || periodRes.financial_year || '',
    part_a_general_info: partA,
    part_b1_tds_tcs_transactions: b1Res.transactions,
    part_b2_sft_transactions: b2Res.transactions,
    part_b3_tax_payments: b3Res.payments,
    part_b4_demand_refunds: b4Res.refunds
  };

  return { schema, section_statuses, warnings };
}

export function extractAisDeterministicJson(rawText: string): AisDeveloperSchema {
  return extractAisEnvelope(rawText).schema;
}

/**
 * Validates the extracted AIS Developer Schema against the Comprehensive Extraction Contract
 */
export function validateAisContract(data: AisDeveloperSchema, isPiiScrubbed = false): VerifiedAisContract {
  return performValidation(data, isPiiScrubbed);
}

interface FieldCheck {
  valid: boolean;
  verifiedMsg: string;
  missingMsg: string;
}

function recordChecks(checks: FieldCheck[], verified: string[], missing: string[]): void {
  for (const check of checks) {
    if (check.valid) {
      verified.push(check.verifiedMsg);
    } else {
      missing.push(check.missingMsg);
    }
  }
}

/**
 * Performs the full validation logic previously in validateAisContract.
 */
function validatePartA(data: AisDeveloperSchema) {
  const verified: string[] = [];
  const missing: string[] = [];
  const partA = data?.part_a_general_info;
  const isPanValid = Boolean(partA?.pan && /^[a-z]{5}\d{4}[a-z]$/i.test(partA.pan.trim()));
  const isFyValid = Boolean(data?.financial_year && /^\d{4}-\d{2}$/.test(data.financial_year.trim()));
  const isAyValid = Boolean(data?.assessment_year && /^\d{4}-\d{2}$/.test(data.assessment_year.trim()));
  const isAssesseeNameValid = Boolean(partA?.name_of_assessee && partA.name_of_assessee.trim().length > 0);
  const hasPartA = isPanValid && (isFyValid || isAyValid) && isAssesseeNameValid;

  recordChecks([
    { valid: isPanValid, verifiedMsg: `PAN Identity (${partA?.pan})`, missingMsg: 'Valid PAN Format (Part A)' },
    { valid: isFyValid, verifiedMsg: `Financial Year (${data?.financial_year})`, missingMsg: 'Financial Year (e.g. 2025-26)' },
    { valid: isAyValid, verifiedMsg: `Assessment Year (${data?.assessment_year})`, missingMsg: 'Assessment Year (e.g. 2026-27)' },
    { valid: isAssesseeNameValid, verifiedMsg: `Taxpayer Legal Name (${partA?.name_of_assessee})`, missingMsg: 'Taxpayer Legal Name' }
  ], verified, missing);

  if (partA?.date_of_birth) verified.push('Date of Birth (Senior Citizen Allowances)');
  if (partA?.address) verified.push('Residential Address & State Jurisdiction');

  return { hasPartA, isPanValid, isFyValid, isAyValid, isAssesseeNameValid, verified, missing, partA };
}

function validatePartB1(data: AisDeveloperSchema) {
  const verified: string[] = [];
  const missing: string[] = [];
  const partB1 = data?.part_b1_tds_tcs_transactions || [];
  let totalGrossCredited = 0;
  let totalTdsDeducted = 0;
  let totalTdsDeposited = 0;
  partB1.forEach(tx => {
    totalGrossCredited += tx.total_amount_credited || 0;
    (tx.line_items || []).forEach(li => {
      const isInactive = (li.status || '').toLowerCase() === 'inactive';
      if (!isInactive) {
        totalTdsDeducted += li.tds_deducted || 0;
        totalTdsDeposited += li.tds_deposited || 0;
      }
    });
  });
  const hasTdsCredits = partB1.length > 0 && (totalTdsDeducted > 0 || totalGrossCredited > 0);
  if (hasTdsCredits) {
    verified.push(`TDS/TCS Credits (${partB1.length} entities, ${totalTdsDeducted.toLocaleString('en-IN')} deducted)`);
  } else {
    missing.push('Part B1 TDS/TCS Transactions');
  }
  return {hasTdsCredits, totalGrossCredited, totalTdsDeducted, totalTdsDeposited, verified, missing};
}

function validatePartB2(data: AisDeveloperSchema) {
  const verified: string[] = [];
  const missing: string[] = [];
  const partB2 = data?.part_b2_sft_transactions || [];
  const totalSftVolume = partB2.reduce((acc, tx) => acc + (tx.amount || (tx as any).transaction_amount || 0), 0);
  const hasSftLedger = partB2.length > 0;
  if (hasSftLedger) {
    verified.push(`SFT Matrix (${partB2.length} records, ${totalSftVolume.toLocaleString('en-IN')})`);
  }
  return {hasSftLedger, totalSftVolume, verified, missing};
}

function validatePartB3(data: AisDeveloperSchema) {
  const verified: string[] = [];
  const missing: string[] = [];
  const partB3 = data?.part_b3_tax_payments || [];
  const totalChallanPaid = partB3.reduce((acc, tx) => acc + (tx.total_challan_amount || tx.tax_amount || 0), 0);
  const hasChallanCIN = partB3.some(tx => /^\d{7}$/.test(tx.bsr_code) && tx.challan_serial_number > 0);
  if (hasChallanCIN) {
    verified.push(`Challan CIN Tokens (${partB3.length} records with 7-digit BSR & Serial)`);
  } else if (partB3.length > 0) {
    verified.push(`Tax Payments (${partB3.length} challan payments accounted)`);
  }
  return {hasChallanCIN, totalChallanPaid, verified, missing, partB3};
}

function validatePartB4(data: AisDeveloperSchema) {
  const verified: string[] = [];
  const missing: string[] = [];
  const partB4 = data?.part_b4_demand_refunds || [];
  const totalRefundAmount = partB4.reduce((acc, tx) => acc + (tx.amount || (tx as any).refund_amount || 0), 0);
  const hasDemandRefund = partB4.length > 0;
  if (hasDemandRefund) {
    verified.push(`Demand & Refund Logs (${partB4.length} records mapped)`);
  }
  return {hasDemandRefund, totalRefundAmount, verified, missing};
}

function performValidation(data: AisDeveloperSchema, isPiiScrubbed = false): VerifiedAisContract {
  const verifiedNodes: string[] = [];
  const missingNodes: string[] = [];

  const partARes = validatePartA(data);
  const partB1Res = validatePartB1(data);
  const partB2Res = validatePartB2(data);
  const partB3Res = validatePartB3(data);
  const partB4Res = validatePartB4(data);

  verifiedNodes.push(...partARes.verified, ...partB1Res.verified, ...partB2Res.verified, ...partB3Res.verified, ...partB4Res.verified);
  missingNodes.push(...partARes.missing, ...partB1Res.missing, ...partB2Res.missing, ...partB3Res.missing, ...partB4Res.missing);

  // Health Score Calculation
  let healthScore = 0;
  if (partARes.isPanValid) healthScore += 25;
  if (partARes.isFyValid && partARes.isAyValid) healthScore += 15;
  else if (partARes.isFyValid || partARes.isAyValid) healthScore += 10;
  if (partARes.isAssesseeNameValid) healthScore += 10;
  if (partB1Res.hasTdsCredits) healthScore += 25;
  if (partB3Res.hasChallanCIN || (partB3Res.partB3 && partB3Res.partB3.length > 0)) healthScore += 15;
  if (partARes.partA?.date_of_birth || partARes.partA?.address) healthScore += 10;

  const isScrubbed = isPiiScrubbed || Boolean(partARes.partA?.pan && (partARes.partA.pan.includes('X') || partARes.partA.pan.includes('*')));

  return {
    isValid: partARes.hasPartA && (partB1Res.hasTdsCredits || partB3Res.hasChallanCIN || partB2Res.hasSftLedger),
    healthScore: Math.min(healthScore, 100),
    hasPartA: partARes.hasPartA,
    hasTdsCredits: partB1Res.hasTdsCredits,
    hasSftLedger: partB2Res.hasSftLedger,
    hasChallanCIN: partB3Res.hasChallanCIN,
    hasDemandRefund: partB4Res.hasDemandRefund,
    isPiiScrubbed: isScrubbed,
    verifiedNodes,
    missingNodes,
    metrics: {
      totalGrossCredited: partB1Res.totalGrossCredited,
      totalTdsDeducted: partB1Res.totalTdsDeducted,
      totalTdsDeposited: partB1Res.totalTdsDeposited,
      totalChallanPaid: partB3Res.totalChallanPaid,
      totalSftVolume: partB2Res.totalSftVolume,
      totalRefundAmount: partB4Res.totalRefundAmount
    }
  };
}


function maskPan(pan: string): string {
  if (!pan || pan.length < 10) return 'XXXXX0000X';
  return `${pan.slice(0, 3)}XXXX${pan.slice(7)}`;
}

function maskAadhaar(aadhaar: string): string {
  if (!aadhaar) return 'XXXX XXXX 0000';
  return `XXXX XXXX ${aadhaar.replace(/\s+/g, '').slice(-4)}`;
}

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return 'masked@assessee.tax';
  const [user, domain] = email.split('@');
  const maskedUser = user.length > 2 ? `${user[0]}***${user.slice(-1)}` : '***';
  return `${maskedUser}@${domain}`;
}

function maskPhone(phone: string): string {
  if (!phone) return 'XXXXX-XXXXX';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return 'XXXXX-XXXXX';
  return `XXXXX-XX${digits.slice(-3)}`;
}

function maskAddress(address: string): string {
  if (!address) return 'MASKED RESIDENTIAL ADDRESS, INDIA';
  const parts = address.split(',');
  const pin = parts.find(p => /\b\d{6}\b/.test(p))?.trim() || 'XXXXXX';
  const state = parts[parts.length - 1]?.trim() || 'INDIA';
  return `REDACTED RESIDENTIAL PREMISES, ${pin}, ${state}`;
}

/**
 * Client-Side PII Scrubber for Safe Diagnostic Sharing and Masked Data Export
 */
export function scrubAisPii(schema: AisDeveloperSchema): AisDeveloperSchema {
  const info = schema.part_a_general_info;

  return {
    ...schema,
    part_a_general_info: {
      ...info,
      pan: maskPan(info.pan),
      aadhaar: maskAadhaar(info.aadhaar),
      email_address: maskEmail(info.email_address),
      mobile_number: maskPhone(info.mobile_number),
      address: maskAddress(info.address)
    }
  };
}

