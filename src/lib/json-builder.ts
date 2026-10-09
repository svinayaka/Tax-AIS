import {
  SCHEMA_VERSION,
  ITR_ROUTING_RULE_VERSION,
  TAX_RULE_VERSION,
  type AisDeveloperSchema,
  type StructuredExtractionResult,
} from '../types/ais';
import { deriveAyFromFy, deriveFyFromAy } from './extractor';
import { getAisRulesetVersion } from './ais-rule-loader';

export function buildJsonStructuredData(
  rawParsed: Record<string, any>,
  textContent: string
): StructuredExtractionResult | null {
  const parsedJson = rawParsed.extraction || rawParsed.aisJson || rawParsed;
  if (!parsedJson.part_a_general_info && !parsedJson.part_b1_tds_tcs_transactions) {
    return null;
  }

  let fy = parsedJson.financial_year || '';
  let ay = parsedJson.assessment_year || '';
  if (!fy && parsedJson.tax_year) {
    ay = parsedJson.tax_year;
    fy = deriveFyFromAy(ay);
  } else if (fy && !ay) {
    ay = deriveAyFromFy(fy);
  }

  const canonicalExtraction: AisDeveloperSchema = {
    financial_year: fy,
    assessment_year: ay,
    tax_year: ay || fy || '',
    part_a_general_info: parsedJson.part_a_general_info || {
      name_of_assessee: '',
      pan: '',
      aadhaar: '',
      date_of_birth: '',
      mobile_number: '',
      email_address: '',
      address: '',
    },
    part_b1_tds_tcs_transactions: parsedJson.part_b1_tds_tcs_transactions || [],
    part_b2_sft_transactions: parsedJson.part_b2_sft_transactions || [],
    part_b3_tax_payments: parsedJson.part_b3_tax_payments || [],
    part_b4_demand_refunds: parsedJson.part_b4_demand_refunds || [],
  };

  return {
    schema_version: rawParsed.schema_version || SCHEMA_VERSION,
    extraction_rules_version: rawParsed.extraction_rules_version || getAisRulesetVersion(),
    itr_routing_rule_version: rawParsed.itr_routing_rule_version || ITR_ROUTING_RULE_VERSION,
    tax_rule_version: rawParsed.tax_rule_version || TAX_RULE_VERSION,
    document_type: rawParsed.document_type || 'AIS',
    extraction: canonicalExtraction,
    section_statuses: rawParsed.section_statuses || {
      part_a: canonicalExtraction.part_a_general_info?.pan ? 'extracted' : 'not-present',
      part_b1: canonicalExtraction.part_b1_tds_tcs_transactions.length > 0 ? 'extracted' : 'not-present',
      part_b2: canonicalExtraction.part_b2_sft_transactions.length > 0 ? 'extracted' : 'not-present',
      part_b3: canonicalExtraction.part_b3_tax_payments.length > 0 ? 'extracted' : 'not-present',
      part_b4: canonicalExtraction.part_b4_demand_refunds.length > 0 ? 'extracted' : 'not-present',
    },
    warnings: rawParsed.warnings || [],
    documentClassification: {
      type: 'ais',
      confidence: 'high',
      score: 98,
      label: 'Annual Information Statement (AIS)',
      icon: 'file-text',
      themeColor: 'var(--ksv-ds-color-indigo-500)',
    },
    summary: {
      overview: `Annual Information Statement for FY ${fy || '—'} / AY ${ay || '—'}`,
      keyHighlights: [],
      completeness: 'Complete',
    },
    metadata: {
      extractionDurationMs: 5,
      characterCount: textContent.length,
      wordCount: textContent.split(/\s+/).length,
      lineCount: textContent.split('\n').length,
      confidenceScore: 98,
      extractedAt: new Date().toISOString(),
    },
    keyValues: {},
    flatKeyValues: [],
    entities: {
      emails: [],
      phones: [],
      urls: [],
      dates: [],
      monetaryAmounts: [],
      identifiers: [],
      organizations: [],
    },
    tables: [],
    sections: [],
    customFieldResults: {},
    aisJson: canonicalExtraction,
  };
}
