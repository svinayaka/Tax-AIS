import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractAisDeterministicJson,
  extractAisEnvelope,
  extractStructuredData,
  extractFinancialYear,
  extractAssessmentYear,
  deriveAyFromFy,
  deriveFyFromAy,
  extractStatutoryPeriod,
  classifyDocumentType,
  validateAisContract,
  AIS_PARSER_REGISTRY
} from '../../src/lib/extractor';
import {
  SCHEMA_VERSION,
  ITR_ROUTING_RULE_VERSION,
  TAX_RULE_VERSION
} from '../../src/types/ais';
import {
  getAisPartARules,
  getAisPartBRules,
  getAisRulesetVersion,
  validateAisRulesForTesting
} from '../../src/lib/ais-rule-loader';
import { detectAisSections } from '../../src/lib/ais-section-detector';

const OFFICIAL_AIS_FIXTURE = `
Part A - General Information
Permanent Account Number (PAN) Aadhaar Number Name of Assessee
ANRPV2797D XXXX XXXX 2537 SIDDI VINAYAKA
Date of Birth Mobile Number E-mail Address
29/07/1988 9480559739 svinayaka290489@gmail.com
Address
NO-189/46, 1ST FLOOR,JAMBUSAVARI DINNE,BANNERGHATTA ROAD S.O,BANGALORE SOUTH, BANGALORE,BANGALORE,560076,KARNATAKA
Financial Year: 2025-26
Assessment Year: 2026-27
------------------------------------------------------------------------------------- Annual Information Statement (Part B) --------------------------------------------------------------------------------------
(All amount values are in INR)
Part B1-Information relating to tax deducted or collected at source
Salary
SR. NO. INFORMATION CODE INFORMATION DESCRIPTION INFORMATION SOURCE COUNT AMOUNT
1 TDS-192 Salary received (Section 192) POWERSCHOOL INDIA PRIVATE LIMITED (BLRP19568D) 9 41,13,692
SR. NO. QUARTER DATE OF PAYMENT/CREDIT AMOUNT PAID/CREDITED TDS DEDUCTED TDS DEPOSITED STATUS
1 Q4(Jan-Mar) 07/01/2026 21,03,820 3,04,294 3,04,294 Active
2 Q3(Oct-Dec) 05/12/2025 2,51,234 40,035 40,035 Active
3 Q3(Oct-Dec) 28/10/2025 2,51,234 40,035 40,035 Active
4 Q3(Oct-Dec) 07/10/2025 2,51,234 40,035 40,035 Active
5 Q2(Jul-Sep) 03/09/2025 2,51,234 40,035 40,035 Active
6 Q2(Jul-Sep) 06/08/2025 2,51,234 40,035 40,035 Active
7 Q1(Apr-Jun) 30/06/2025 2,51,234 40,035 40,035 Active
8 Q1(Apr-Jun) 31/05/2025 2,51,234 40,035 40,035 Active
9 Q1(Apr-Jun) 07/05/2025 2,51,234 40,035 40,035 Active
10 Q3(Oct-Dec) 07/10/2025 2,51,234 40,035 40,035 Inactive
11 Q2(Jul-Sep) 03/09/2025 2,51,234 40,035 40,035 Inactive
12 Q2(Jul-Sep) 06/08/2025 2,51,234 40,035 40,035 Inactive
Interest from others
SR. NO. INFORMATION CODE INFORMATION DESCRIPTION INFORMATION SOURCE COUNT AMOUNT
2 TDS-193 Interest received on securities (Section 193) KEERTANA FINSERV LIMITED (CALR17935B) 3 281
SR. NO. QUARTER DATE OF PAYMENT/CREDIT AMOUNT PAID/CREDITED TDS DEDUCTED TDS DEPOSITED STATUS
1 Q4(Jan-Mar) 09/03/2026 87 9 9 Active
2 Q4(Jan-Mar) 09/02/2026 97 10 10 Active
3 Q4(Jan-Mar) 09/01/2026 97 10 10 Active
4 Q4(Jan-Mar) 09/03/2026 87 9 9 Inactive
SR. NO. INFORMATION CODE INFORMATION DESCRIPTION INFORMATION SOURCE COUNT AMOUNT
3 TDS-193 Interest received on securities (Section 193) AMBIUM FINSERVE PRIVATE LIMITED (PTLA16190G) 3 276
SR. NO. QUARTER DATE OF PAYMENT/CREDIT AMOUNT PAID/CREDITED TDS DEDUCTED TDS DEPOSITED STATUS
1 Q4(Jan-Mar) 19/03/2026 86 0 0 Active
2 Q4(Jan-Mar) 19/02/2026 95 0 0 Active
3 Q4(Jan-Mar) 19/01/2026 95 0 0 Active
SR. NO. INFORMATION CODE INFORMATION DESCRIPTION INFORMATION SOURCE COUNT AMOUNT
4 TDS-193 Interest received on securities (Section 193) HDFC BANK LIMITED (MUMH03189E) 2 80
SR. NO. QUARTER DATE OF PAYMENT/CREDIT AMOUNT PAID/CREDITED TDS DEDUCTED TDS DEPOSITED STATUS
1 Q4(Jan-Mar) 01/01/2026 40 0 0 Active
2 Q2(Jul-Sep) 01/07/2025 40 0 0 Active
Outward foreign remittance/purchase of foreign currency
SR. NO. INFORMATION CODE INFORMATION DESCRIPTION INFORMATION SOURCE COUNT AMOUNT
5 TCS-206CQ Remittance under LRS (u/s 206C(1G(a))) HDFC BANK LIMITED (MUMH03189E) 4 4,927
SR. NO. QUARTER DATE OF RECEIPT/ DEBIT AMOUNT RECEIVED/DEBITED TAX COLLECTED TCS DEPOSITED STATUS
1 Q3(Oct-Dec) 09/10/2025 419 0 0 Active
2 Q2(Jul-Sep) 09/09/2025 417 0 0 Active
3 Q2(Jul-Sep) 09/08/2025 2,072 0 0 Active
4 Q2(Jul-Sep) 07/07/2025 2,019 0 0 Active
Note - If there is variation between the TDS/TCS information as displayed in Form26AS on TRACES portal, and the TDS/TCS information as displayed in AIS on Compliance Portal, the taxpayer may rely on the 
information displayed on TRACES portal for the purpose of filing of tax return and for other tax compliance purposes.
Part B2-Information relating to specified financial transaction (SFT)
Dividend
SR. NO. INFORMATION CODE INFORMATION DESCRIPTION INFORMATION SOURCE COUNT AMOUNT
1 SFT-015 Dividend income (SFT-015) STEEL CITY SECURITIES LIMITED (AAECS0970L.AZ804) 1 12
SR. NO. REPORTED ON DIVIDEND AMOUNT STATUS
1 28/05/2026 12 Active

Part B7-Any other information in relation to sub-rule (2) of rule 114-I
Salary
SR. NO. INFORMATION CODE INFORMATION DESCRIPTION INFORMATION SOURCE COUNT AMOUNT
1 TDS-Ann.II-SAL Salary (TDS Annexure II) POWERSCHOOL INDIA PRIVATE LIMITED (BLRP19568D) 1 41,13,692
SR. NO. EMPLOYMENT START DATE EMPLOYMENT END DATE GROSS SALARY U/S 17(1) VALUE OF PERQUISITES U/S 17(2) PROFITS IN LIEU OF SALARY U/S 17(3) GROSS SALARY STATUS
1 01/04/2025 31/12/2025 41,09,187 4,505 0 41,13,692 Active
Part B3-Information relating to payment of taxes
SR. NO. FINANCIAL YEAR MAJOR HEAD MINOR HEAD TAX (A) SURCHARGE (B) EDUCATION CESS (C) OTHERS (D) TOTAL (A+B+C+D) BSR CODE DATE OF DEPOSIT CHALLAN SERIAL NUMBER CHALLAN IDENTIFICATION NUMBER
1 2024-25 Income Tax (Other than Companies) Self Assessment 6,050 0 0 0 6,050 0002271 28/07/2025 63043 25072800207881SBIN
Part B4-Information relating to demand and refund
Refund
SR. NO. FINANCIAL YEAR MODE NATURE OF REFUND REFUND AMOUNT DATE OF PAYMENT
1 2024-25 ECS ECS (direct credit to bank account) 790 31/10/2025
`;

test('1. Official AIS Fixture - Deductor Count & Isolation', () => {
  const result = extractAisDeterministicJson(OFFICIAL_AIS_FIXTURE);

  // Must isolate Part B1 and extract only the true B1 deductors (not Part B7 annexure salary)
  const deductorSources = result.part_b1_tds_tcs_transactions.map(t => t.information_source);

  // Assert exactly 5 entities parsed from B1
  assert.equal(result.part_b1_tds_tcs_transactions.length, 5, 'Should have exactly 5 distinct deductors/collectors');

  // Assert deductor details
  const powerSchool = result.part_b1_tds_tcs_transactions.find(t => t.information_source.includes('POWERSCHOOL'));
  assert.ok(powerSchool, 'PowerSchool entity must exist');
  assert.equal(powerSchool.total_amount_credited, 4113692);
  assert.equal(powerSchool.information_code, 'TDS-192');

  // Assert Line items strictly within PowerSchool boundary
  // 9 Active + 3 Inactive = 12 line items
  assert.equal(powerSchool.line_items.length, 12, 'PowerSchool must have exactly 12 line items');
  const activeItems = powerSchool.line_items.filter(li => li.status === 'Active');
  const inactiveItems = powerSchool.line_items.filter(li => li.status === 'Inactive');
  assert.equal(activeItems.length, 9, 'Must have 9 active items');
  assert.equal(inactiveItems.length, 3, 'Must have 3 inactive items');

  // Verify Keertana Finserv details
  const keertana = result.part_b1_tds_tcs_transactions.find(t => t.information_source.includes('KEERTANA'));
  assert.ok(keertana, 'Keertana entity must exist');
  assert.equal(keertana.line_items.length, 4, 'Keertana must retain exactly 4 line items');
  assert.equal(keertana.line_items.filter(li => li.status === 'Active').length, 3);
  assert.equal(keertana.line_items.filter(li => li.status === 'Inactive').length, 1);

  // Assert no TDS Annexure record leaked as top-level deductor
  assert.equal(deductorSources.some(s => s.includes('Annexure')), false);
  assert.equal(result.part_b1_tds_tcs_transactions.some(t => t.information_code.includes('TDS-Ann')), false);
});

test('2. Boundary Isolation - No Cross-Deductor Borrowing or Spillover', () => {
  const isolatedFixture = `
Part A - General Information
Permanent Account Number (PAN): ABCDE1234F
Financial Year: 2025-26
Assessment Year: 2026-27
Part B1-Information relating to tax deducted or collected at source
Interest from others
SR. NO. INFORMATION CODE INFORMATION DESCRIPTION INFORMATION SOURCE COUNT AMOUNT
1 TDS-194A Interest other than interest on securities FIRST BANK (AAAA11111A) 2 50,000
SR. NO. INFORMATION CODE INFORMATION DESCRIPTION INFORMATION SOURCE COUNT AMOUNT
2 TDS-194A Interest other than interest on securities SECOND BANK (BBBB22222B) 2 100,000
SR. NO. QUARTER DATE OF PAYMENT/CREDIT AMOUNT PAID/CREDITED TDS DEDUCTED TDS DEPOSITED STATUS
1 Q1 15/05/2025 10,000 1,000 1,000 Active
2 Q2 15/08/2025 10,000 1,000 1,000 Active
Part B2-Information relating to specified financial transaction (SFT)
`;

  const { schema, warnings } = extractAisEnvelope(isolatedFixture);
  const d1 = schema.part_b1_tds_tcs_transactions.find(d => d.information_source.includes('FIRST BANK'));
  const d2 = schema.part_b1_tds_tcs_transactions.find(d => d.information_source.includes('SECOND BANK'));

  assert.ok(d1, 'Deductor 1 must exist');
  assert.ok(d2, 'Deductor 2 must exist');
  assert.equal(d1.line_items.length, 0, 'Deductor 1 must have 0 rows (no borrowing from Deductor 2)');
  assert.equal(d2.line_items.length, 2, 'Deductor 2 must retain its own 2 rows');

  // Verify warning was emitted for Deductor 1 missing detail table
  const warningD1 = warnings.find(w => w.code === 'B1_SUMMARY_WITHOUT_DETAILS');
  assert.ok(warningD1, 'Warning B1_SUMMARY_WITHOUT_DETAILS should be emitted for empty detail block');
});

test('3. Section Isolation - Missing Part B1 Boundary Produces No Fabricated Transactions', () => {
  const missingB1Fixture = `
Part A - General Information
Permanent Account Number (PAN): ABCDE1234F
Financial Year: 2025-26
Assessment Year: 2026-27
Part B2-Information relating to specified financial transaction (SFT)
SR. NO. INFORMATION CODE INFORMATION DESCRIPTION INFORMATION SOURCE COUNT AMOUNT
1 SFT-015 Dividend income (SFT-015) CORP LTD (AAECS0970L) 1 500
`;

  const { schema, section_statuses, warnings } = extractAisEnvelope(missingB1Fixture);
  assert.equal(section_statuses.B1, 'not-present');
  assert.equal(schema.part_b1_tds_tcs_transactions.length, 0, 'No B1 transactions should be returned');
  const b1NotFoundWarning = warnings.find(w => w.code === 'B1_SECTION_NOT_FOUND');
  assert.ok(b1NotFoundWarning, 'Should emit B1_SECTION_NOT_FOUND warning');
});

test('4. No Synthetic Fallbacks Generated', () => {
  const emptyText = `
Some random non-tax PDF text with arbitrary numbers 1234567 8901234
A PAN number somewhere: ABCDE1234F
`;

  const { schema } = extractAisEnvelope(emptyText);
  assert.equal(schema.part_b1_tds_tcs_transactions.length, 0);
  assert.equal(schema.part_b3_tax_payments.length, 0);
  assert.equal(schema.part_b4_demand_refunds.length, 0);

  const rawJson = JSON.stringify(schema);
  assert.equal(rawJson.includes('Deductor Entity'), false, 'Never invent "Deductor Entity"');
  assert.equal(rawJson.includes('TDS-194A'), false, 'Never invent "TDS-194A"');
});

test('5. Statutory Period Parsing & Deterministic Derivation', () => {
  assert.equal(deriveAyFromFy('2025-26'), '2026-27');
  assert.equal(deriveFyFromAy('2026-27'), '2025-26');
  assert.equal(deriveAyFromFy('2024-25'), '2025-26');
  assert.equal(deriveFyFromAy('2025-26'), '2024-25');

  const bothText = 'Financial Year: 2025-26\nAssessment Year: 2026-27';
  const pBoth = extractStatutoryPeriod(bothText);
  assert.equal(pBoth.financial_year, '2025-26');
  assert.equal(pBoth.assessment_year, '2026-27');
  assert.equal(pBoth.warnings.length, 0);

  const fyOnly = 'Financial Year: 2025-26';
  const pFy = extractStatutoryPeriod(fyOnly);
  assert.equal(pFy.financial_year, '2025-26');
  assert.equal(pFy.assessment_year, '2026-27');

  const ayOnly = 'Assessment Year: 2026-27';
  const pAy = extractStatutoryPeriod(ayOnly);
  assert.equal(pAy.financial_year, '2025-26');
  assert.equal(pAy.assessment_year, '2026-27');

  const noneText = 'Hello world with no tax years';
  const pNone = extractStatutoryPeriod(noneText);
  assert.equal(pNone.financial_year, '');
  assert.equal(pNone.assessment_year, '');
  const periodWarn = pNone.warnings.find(w => w.code === 'PERIOD_NOT_FOUND');
  assert.ok(periodWarn, 'PERIOD_NOT_FOUND warning should be emitted when period is missing');
});

test('6. Document Classification & Form 168 Separation', () => {
  const aisText = 'Government of India\nAnnual Information Statement\nPart A - General Information';
  assert.equal(classifyDocumentType(aisText), 'ais');

  const form168Text = 'Income-tax Department\nForm No. 168\nAnnual Information Statement';
  const classified168 = classifyDocumentType(form168Text);
  assert.notEqual(classified168, 'ais', 'Form 168 must not be classified as current AY 2026-27 AIS');
  assert.equal(classified168, 'form_168_future');

  const f26asText = 'Form 26AS\nAnnual Tax Statement under Section 203AA';
  assert.equal(classifyDocumentType(f26asText), 'form_26as');
});

test('7. StructuredExtractionResult Architecture Alignment', () => {
  const structured = extractStructuredData(OFFICIAL_AIS_FIXTURE);

  assert.equal(structured.schema_version, SCHEMA_VERSION);
  assert.equal(structured.extraction_rules_version, getAisRulesetVersion());
  assert.equal(structured.extraction_rules_version, '1.0');
  assert.equal(structured.itr_routing_rule_version, ITR_ROUTING_RULE_VERSION);
  assert.equal(structured.tax_rule_version, TAX_RULE_VERSION);
  assert.equal(structured.document_type, 'AIS');

  assert.ok(structured.extraction, 'StructuredExtractionResult must include extraction envelope');
  assert.ok(structured.section_statuses, 'StructuredExtractionResult must include section_statuses');
  assert.equal(structured.section_statuses.A, 'extracted');
  assert.equal(structured.section_statuses.B1, 'extracted');
  assert.equal(structured.section_statuses.B2, 'extracted');
  assert.equal(structured.section_statuses.B3, 'extracted');
  assert.equal(structured.section_statuses.B4, 'extracted');
  assert.ok(Array.isArray(structured.warnings));

  assert.equal(structured.aisJson?.financial_year, '2025-26');
  assert.equal(structured.aisJson?.assessment_year, '2026-27');
});

test('8. Part B2 SFT Semantics - Informational Only', () => {
  const sftFixture = `
Part A - General Information
Permanent Account Number (PAN): ABCDE1234F
Financial Year: 2025-26
Assessment Year: 2026-27
Part B2-Information relating to specified financial transaction (SFT)
SR. NO. INFORMATION CODE INFORMATION DESCRIPTION INFORMATION SOURCE COUNT AMOUNT
1 SFT-017 Sale of shares or units of mutual funds XYZ BROKING LTD (AAAA11111A) 1 1,500,000
SR. NO. REPORTED ON TRANSACTION AMOUNT STATUS
1 15/01/2026 1,500,000 Active
`;

  const { schema } = extractAisEnvelope(sftFixture);
  const sft17 = schema.part_b2_sft_transactions.find(t => t.information_code === 'SFT-017');
  assert.ok(sft17, 'SFT-017 transaction must be parsed');
  assert.equal(sft17.amount, 1500000, 'Raw transaction amount is preserved');

  const jsonStr = JSON.stringify(schema);
  assert.equal(jsonStr.includes('stcg'), false);
  assert.equal(jsonStr.includes('ltcg'), false);
  assert.equal(jsonStr.includes('taxable_gain'), false);
});

test('9. Schema Validation Contract - Separate FY and AY Validation', () => {
  const validData = {
    financial_year: '2025-26',
    assessment_year: '2026-27',
    part_a_general_info: {
      pan: 'ABCDE1234F',
      aadhaar: 'XXXX XXXX 1234',
      name_of_assessee: 'Test User',
      date_of_birth: '01/01/1990',
      mobile_number: '9999999999',
      email_address: 'test@example.com',
      address: 'Test Address'
    },
    part_b1_tds_tcs_transactions: [],
    part_b2_sft_transactions: [],
    part_b3_tax_payments: [],
    part_b4_demand_refunds: []
  };

  const validation = validateAisContract(validData);
  assert.ok(validation.verifiedNodes.some(v => v.includes('Financial Year (2025-26)')));
  assert.ok(validation.verifiedNodes.some(v => v.includes('Assessment Year (2026-27)')));
  assert.ok(validation.verifiedNodes.some(v => v.includes('PAN Identity (ABCDE1234F)')));
});

test('10. Form 168 Recognized as Future Statutory Mode Without Silently Routing Through ITA 1961 AY Logic', () => {
  const form168Doc = `
Income-tax Department
Form No. 168
Annual Information Statement
Tax Year: 2026-27
Part A - Assessee Information
Permanent Account Number: ABCDE1234F
`;

  const structured = extractStructuredData(form168Doc);
  assert.equal(structured.extraction, null, 'Form 168 must not silently route into ITA 1961 AisDeveloperSchema');
  assert.equal(structured.documentClassification.type, 'form_168_future');
  const form168Warning = structured.warnings.find(w => w.code === 'FORM_168_FUTURE_MODE');
  assert.ok(form168Warning, 'Must emit FORM_168_FUTURE_MODE warning');
  assert.ok(form168Warning?.message.includes('future statutory format'));
});

test('11. Official Form 168 AIS Document Classification & No AY/FY Fabrication', () => {
  const form168Fixture = `Annual Information Statement (AIS - Form 168) Tax Year (T.Y.) 2026-27

Part A - General Information
Permanent Account Number (PAN) Aadhaar Number Name of Assessee
ANRPV2797D XXXX XXXX 2537 SIDDI VINAYAKA
Date of Birth Mobile Number E-mail Address
29/07/1988 9480559739 svinayaka290489@gmail.com
Address
NO-189/46, 1ST FLOOR,JAMBUSAVARI DINNE,BANNERGHATTA ROAD S.O,BANGALORE SOUTH, BANGALORE,BANGALORE,560076,KARNATAKA
------------------------------------------------------------------------------------- Annual Information Statement (Part B) --------------------------------------------------------------------------------------
(All amount values are in INR)
Part B1-Information relating to tax deducted or collected at source
Interest from others
SR. NO. INFORMATION CODE INFORMATION DESCRIPTION INFORMATION SOURCE COUNT AMOUNT
1 TDS-393(1)[Table: S.No. 5(i)] Interest received on securities (Section 393(1) [Table: 
S.No. 5(i)])
AKARA CAPITAL ADVISORS PRIVATE LIMITED (DELA43380B) 3 523
SR. NO. QUARTER DATE OF PAYMENT/CREDIT AMOUNT PAID/CREDITED TDS DEDUCTED TDS DEPOSITED STATUS
1 Q1(Apr-Jun) 19/06/2026 204 20 20 Active
2 Q1(Apr-Jun) 20/05/2026 197 20 20 Active
3 Q1(Apr-Jun) 20/04/2026 122 12 12 Active
SR. NO. INFORMATION CODE INFORMATION DESCRIPTION INFORMATION SOURCE COUNT AMOUNT
2 TDS-393(1)[Table: S.No. 5(i)] Interest received on securities (Section 393(1) [Table: 
S.No. 5(i)])
KEERTANA FINSERV LIMITED (CALR17935B) 3 288
SR. NO. QUARTER DATE OF PAYMENT/CREDIT AMOUNT PAID/CREDITED TDS DEDUCTED TDS DEPOSITED STATUS
1 Q1(Apr-Jun) 09/06/2026 97 10 10 Active
2 Q1(Apr-Jun) 09/05/2026 94 9 9 Active
3 Q1(Apr-Jun) 09/04/2026 97 10 10 Active
Note - If there is variation between the TDS/TCS information as displayed in Form26AS on TRACES portal, and the TDS/TCS information as displayed in AIS on Compliance Portal, the taxpayer may rely on the 
information displayed on TRACES portal for the purpose of filing of tax return and for other tax compliance purposes.
Part B2-Information relating to specified financial transaction (SFT)
SR. NO. INFORMATION CODE INFORMATION DESCRIPTION INFORMATION SOURCE COUNT AMOUNT
No Transactions Present
Part B7-Any other information in relation to sub-rule (2) of rule 114-I
SR. NO. INFORMATION CODE INFORMATION DESCRIPTION INFORMATION SOURCE COUNT AMOUNT
No Transactions Present
Part B3-Information relating to payment of taxes
SR. NO. FINANCIAL 
YEAR
MAJOR HEAD MINOR HEAD TAX (A) SURCHARGE (B) EDUCATION 
CESS (C)
OTHERS (D) TOTAL (A+B+C
+D)
BSR CODE DATE OF 
DEPOSIT
CHALLAN 
SERIAL 
NUMBER
CHALLAN IDENTIFICATION NUMBER
1 2025-26 Income Tax 
(Other than 
Companies)
Self 
Assessment
2,003 0 0 0 2,003 0180002 31/07/2026 27897 26073100549820KKBK
Note - For financial year 2022-23 and earlier, details of tax payments are available in both Form 26AS on the TRACES portal and Annual Information Statement (AIS) on the Compliance Portal.
Part B4-Information relating to demand and refund
Refund
SR. NO. FINANCIAL YEAR MODE NATURE OF REFUND REFUND AMOUNT DATE OF PAYMENT
No Transactions Present
Annual Information Statement (AIS - Form 168) Tax Year (T.Y.) 2026-27`;

  const structured = extractStructuredData(form168Fixture);
  assert.equal(structured.documentClassification.type, 'form_168_future');
  assert.equal(structured.extraction, null, 'Must not fabricate ITA 1961 extraction schema for Form 168');
  const warning = structured.warnings.find(w => w.code === 'FORM_168_FUTURE_MODE');
  assert.ok(warning, 'FORM_168_FUTURE_MODE warning must be present');
});

test('12. Declarative Rule Configuration Loading & Structure Validation', () => {
  const partA = getAisPartARules();
  assert.equal(partA.rulesetVersion, '1.0');
  assert.equal(partA.statutoryRegime, 'ITA_1961');
  assert.equal(partA.part, 'A');
  assert.ok(partA.sectionDetection.startMarkers.length > 0);
  assert.ok(partA.fields.name_of_assessee);
  assert.ok(partA.fields.pan);
  assert.ok(partA.fields.aadhaar);
  assert.ok(partA.fields.financial_year);
  assert.ok(partA.fields.assessment_year);
  assert.equal(partA.failurePolicy.missingSectionStatus, 'not-present');
  assert.equal(partA.failurePolicy.neverFabricateValues, true);

  const partB = getAisPartBRules();
  assert.equal(partB.rulesetVersion, '1.0');
  assert.equal(partB.statutoryRegime, 'ITA_1961');
  assert.equal(partB.part, 'B');
  assert.equal(partB.sections.B1.parser, 'partB1');
  assert.equal(partB.sections.B2.parser, 'partB2');
  assert.equal(partB.sections.B3.parser, 'partB3');
  assert.equal(partB.sections.B4.parser, 'partB4');
  assert.equal(partB.sectionDetection.unknownSectionPolicy, 'preserve-as-unsupported');
  assert.equal(partB.unknownSection.status, 'unsupported');
  assert.equal(partB.unknownSection.supported, false);

  assert.equal(getAisRulesetVersion(), '1.0');
});

test('13. Malformed Bundled Rules Fail Safely Without Fabricating Defaults', () => {
  // Missing rulesetVersion
  assert.throws(
    () => validateAisRulesForTesting({ part: 'A' }, { part: 'B' }),
    /Missing or invalid rulesetVersion/
  );

  // Invalid parser ID in Part B
  const validPartA = getAisPartARules();
  const validPartB = getAisPartBRules();
  const invalidPartB = {
    ...validPartB,
    sections: {
      B1: { parser: 'unsafeDynamicFunction' as any }
    }
  };
  assert.throws(
    () => validateAisRulesForTesting(validPartA, invalidPartB),
    /Invalid parser ID "unsafeDynamicFunction"/
  );

  // Unsupported/non-ITA_1961 statutoryRegime strictly rejected
  assert.throws(
    () => validateAisRulesForTesting({ ...validPartA, statutoryRegime: 'ITA_2025' as any }, validPartB),
    /Expected statutoryRegime "ITA_1961"/
  );
  assert.throws(
    () => validateAisRulesForTesting(validPartA, { ...validPartB, statutoryRegime: 'ITA_2025' as any }),
    /Expected statutoryRegime "ITA_1961"/
  );

  // Version mismatch check between Part A and Part B
  const mismatchA = { ...validPartA, rulesetVersion: '1.0' };
  const mismatchB = { ...validPartB, rulesetVersion: '2.0' };
  const validatedMismatch = validateAisRulesForTesting(mismatchA, mismatchB);
  assert.notEqual(validatedMismatch.partA.rulesetVersion, validatedMismatch.partB.rulesetVersion);
});

test('14. Static Parser Registry Mapping & Dispatch Integrity', () => {
  assert.equal(typeof AIS_PARSER_REGISTRY.partA, 'function');
  assert.equal(typeof AIS_PARSER_REGISTRY.partB1, 'function');
  assert.equal(typeof AIS_PARSER_REGISTRY.partB2, 'function');
  assert.equal(typeof AIS_PARSER_REGISTRY.partB3, 'function');
  assert.equal(typeof AIS_PARSER_REGISTRY.partB4, 'function');

  // Verify pure dispatch without eval
  const samplePartA = AIS_PARSER_REGISTRY.partA('Permanent Account Number (PAN): ABCDE1234F\nName of Assessee: JOHN DOE');
  assert.equal(samplePartA.pan, 'ABCDE1234F');
  assert.equal(samplePartA.name_of_assessee, 'JOHN DOE');
});

test('15. Unknown Section Discovery (e.g. Part B7) and Isolation from B1-B4', () => {
  const partARules = getAisPartARules();
  const partBRules = getAisPartBRules();
  const detected = detectAisSections(OFFICIAL_AIS_FIXTURE, partARules, partBRules);

  // Discovered sections must include B1, B2, B7, B3, B4
  const sectionIds = detected.partBSections.map(s => s.id);
  assert.ok(sectionIds.includes('B1'));
  assert.ok(sectionIds.includes('B2'));
  assert.ok(sectionIds.includes('B7'), 'Part B7 must be discovered');
  assert.ok(sectionIds.includes('B3'));
  assert.ok(sectionIds.includes('B4'));

  const b7Section = detected.partBSections.find(s => s.id === 'B7');
  assert.ok(b7Section);
  assert.equal(b7Section.supported, false, 'B7 must be marked supported: false');

  // Envelope section statuses must preserve B7 as unsupported
  const envelope = extractAisEnvelope(OFFICIAL_AIS_FIXTURE);
  assert.equal(envelope.section_statuses.B7, 'unsupported');
  assert.equal(envelope.section_statuses.B1, 'extracted');

  // B7 Salary Annexure must NOT be routed into B1 transactions
  const hasB7InB1 = envelope.schema.part_b1_tds_tcs_transactions.some(tx =>
    tx.information_code.toUpperCase().includes('ANN')
  );
  assert.equal(hasB7InB1, false, 'Annexure must not appear in Part B1 transactions');
});

test('16. Deductor Block Isolation — Zero Cross-Deductor Spillover in Official Fixture', () => {
  const envelope = extractAisEnvelope(OFFICIAL_AIS_FIXTURE);
  const deductors = envelope.schema.part_b1_tds_tcs_transactions;

  // PowerSchool has exactly 12 line items (9 Active + 3 Inactive)
  const powerSchool = deductors.find(d => d.information_source.includes('POWERSCHOOL'));
  assert.ok(powerSchool, 'PowerSchool deductor must exist');
  assert.equal(powerSchool.line_items.length, 12);
  const psActive = powerSchool.line_items.filter(li => li.status === 'Active');
  const psInactive = powerSchool.line_items.filter(li => li.status === 'Inactive');
  assert.equal(psActive.length, 9);
  assert.equal(psInactive.length, 3);

  // Keertana has exactly 4 line items (3 Active + 1 Inactive)
  const keertana = deductors.find(d => d.information_source.includes('KEERTANA'));
  assert.ok(keertana, 'Keertana deductor must exist');
  assert.equal(keertana.line_items.length, 4);
  const kActive = keertana.line_items.filter(li => li.status === 'Active');
  const kInactive = keertana.line_items.filter(li => li.status === 'Inactive');
  assert.equal(kActive.length, 3);
  assert.equal(kInactive.length, 1);

  // Total credited salary should be strictly 41,13,692 (not doubled)
  assert.equal(powerSchool.total_amount_credited, 4113692);
});

test('17. Extraction Rules Version Propagation in Envelope', () => {
  const structured = extractStructuredData(OFFICIAL_AIS_FIXTURE);
  assert.equal(structured.schema_version, '1.0');
  assert.equal(structured.extraction_rules_version, '1.0');
  assert.equal(structured.itr_routing_rule_version, 'AY2026-27.1');
  assert.equal(structured.tax_rule_version, 'AY2026-27.1');
});

test('18. Section Status Semantics and Zero PII in Warnings', () => {
  const partialDoc = `
Part A - General Information
Permanent Account Number (PAN): ANRPV2797D
Financial Year: 2025-26
Assessment Year: 2026-27
Name of Assessee: SIDDI VINAYAKA
Address: 123 BANGALORE
`;
  const envelope = extractAisEnvelope(partialDoc);
  assert.equal(envelope.section_statuses.part_a, 'extracted');
  assert.equal(envelope.section_statuses.part_b1, 'not-present');
  assert.equal(envelope.section_statuses.part_b2, 'not-present');
  assert.equal(envelope.section_statuses.part_b3, 'not-present');
  assert.equal(envelope.section_statuses.part_b4, 'not-present');

  // Verify warnings contain zero PII (no PAN, name, or address)
  for (const warning of envelope.warnings) {
    assert.equal(warning.message.includes('ANRPV2797D'), false, 'Warning must not contain PAN');
    assert.equal(warning.message.includes('SIDDI VINAYAKA'), false, 'Warning must not contain taxpayer name');
    assert.equal(warning.message.includes('BANGALORE'), false, 'Warning must not contain address');
  }
});
