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
  validateAisContract
} from '../src/lib/extractor';
import {
  SCHEMA_VERSION,
  ITR_ROUTING_RULE_VERSION,
  TAX_RULE_VERSION
} from '../src/types/ais';

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
  const envelope = extractAisEnvelope(OFFICIAL_AIS_FIXTURE);
  const { schema, section_statuses, warnings } = envelope;

  // Assert section status
  assert.equal(section_statuses.B1, 'extracted');
  assert.equal(section_statuses.A, 'extracted');

  const deductors = schema.part_b1_tds_tcs_transactions;

  // 1. Exactly 5 Part B1 summary entities
  assert.equal(deductors.length, 5, 'Must have exactly 5 Part B1 deductors');

  // 2. No TDS-ANN summary appears in Part B1
  const hasAnnexure = deductors.some(d => d.information_code.toUpperCase().startsWith('TDS-ANN'));
  assert.equal(hasAnnexure, false, 'No TDS-ANN summary should exist in Part B1');

  // 3. Salary deductor (PowerSchool)
  const salary = deductors.find(d => d.information_code === 'TDS-192');
  assert.ok(salary, 'PowerSchool salary deductor must exist');
  assert.equal(salary.total_amount_credited, 4113692);
  assert.equal(salary.line_items.length, 12, 'Must preserve all 12 lines (9 active + 3 inactive)');
  const salaryActive = salary.line_items.filter(li => li.status === 'Active');
  const salaryInactive = salary.line_items.filter(li => li.status === 'Inactive');
  assert.equal(salaryActive.length, 9, 'Salary must have exactly 9 Active rows');
  assert.equal(salaryInactive.length, 3, 'Salary must have exactly 3 Inactive rows');
  const salaryActiveCredited = salaryActive.reduce((sum, li) => sum + li.amount_paid_credited, 0);
  assert.equal(salaryActiveCredited, 4113692, 'Salary active rows must total 4,113,692');

  // 4. Keertana Finserv
  const keertana = deductors.find(d => d.information_source.includes('KEERTANA'));
  assert.ok(keertana, 'Keertana deductor must exist');
  assert.equal(keertana.line_items.length, 4, 'Keertana must have exactly 4 physical detail rows');
  const keertanaActive = keertana.line_items.filter(li => li.status === 'Active');
  const keertanaInactive = keertana.line_items.filter(li => li.status === 'Inactive');
  assert.equal(keertanaActive.length, 3, 'Keertana must have 3 Active rows');
  assert.equal(keertanaInactive.length, 1, 'Keertana must have 1 Inactive row');
  const keertanaActiveCredited = keertanaActive.reduce((sum, li) => sum + li.amount_paid_credited, 0);
  const keertanaActiveTds = keertanaActive.reduce((sum, li) => sum + li.tds_deposited, 0);
  assert.equal(keertanaActiveCredited, 281, 'Keertana active credited total must be 281');
  assert.equal(keertanaActiveTds, 29, 'Keertana active TDS deposited must be 29');

  // 5. Ambium Finserve
  const ambium = deductors.find(d => d.information_source.includes('AMBIUM'));
  assert.ok(ambium, 'Ambium deductor must exist');
  assert.equal(ambium.line_items.length, 3, 'Ambium must have 3 detail rows');
  const ambiumActiveCredited = ambium.line_items
    .filter(li => li.status === 'Active')
    .reduce((sum, li) => sum + li.amount_paid_credited, 0);
  assert.equal(ambiumActiveCredited, 276, 'Ambium active credited total must be 276');

  // 6. HDFC Bank TDS
  const hdfcTds = deductors.find(d => d.information_code === 'TDS-193' && d.information_source.includes('HDFC'));
  assert.ok(hdfcTds, 'HDFC TDS deductor must exist');
  assert.equal(hdfcTds.line_items.length, 2, 'HDFC TDS must have 2 detail rows');
  const hdfcTdsCredited = hdfcTds.line_items
    .filter(li => li.status === 'Active')
    .reduce((sum, li) => sum + li.amount_paid_credited, 0);
  assert.equal(hdfcTdsCredited, 80, 'HDFC TDS active credited total must be 80');

  // 7. HDFC Bank TCS / LRS
  const hdfcTcs = deductors.find(d => d.information_code === 'TCS-206CQ' && d.information_source.includes('HDFC'));
  assert.ok(hdfcTcs, 'HDFC TCS deductor must exist');
  assert.equal(hdfcTcs.line_items.length, 4, 'HDFC TCS must have 4 detail rows');
  const hdfcTcsCredited = hdfcTcs.line_items
    .filter(li => li.status === 'Active')
    .reduce((sum, li) => sum + li.amount_paid_credited, 0);
  const hdfcTcsDeposited = hdfcTcs.line_items
    .filter(li => li.status === 'Active')
    .reduce((sum, li) => sum + li.tds_deposited, 0);
  assert.equal(hdfcTcsCredited, 4927, 'HDFC TCS active credited total must be 4,927');
  assert.equal(hdfcTcsDeposited, 0, 'HDFC TCS deposited must be 0');
});

test('2. Boundary Isolation - No Cross-Deductor Borrowing or Spillover', () => {
  // Construct a fixture where Deductor 1 summary claims COUNT=2 but detail ledger has 0 rows.
  // Deductor 2 has 2 detail rows.
  // Deductor 1 must NOT borrow rows from Deductor 2!
  const isolatedFixture = `
Part A - General Information
Permanent Account Number (PAN): ABCDE1234F
Financial Year: 2025-26
Assessment Year: 2026-27
Part B1-Information relating to tax deducted or collected at source
SR. NO. INFORMATION CODE INFORMATION DESCRIPTION INFORMATION SOURCE COUNT AMOUNT
1 TDS-194A Interest other than securities FIRST BANK (AAAA11111A) 2 10,000
SR. NO. INFORMATION CODE INFORMATION DESCRIPTION INFORMATION SOURCE COUNT AMOUNT
2 TDS-193 Interest on securities SECOND BANK (BBBB22222B) 2 20,000
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
  // Test arbitrary text without deductors: should NEVER generate "TDS-194A" or "Deductor Entity"
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
  // Deterministic derivation for Income-tax Act, 1961
  assert.equal(deriveAyFromFy('2025-26'), '2026-27');
  assert.equal(deriveFyFromAy('2026-27'), '2025-26');
  assert.equal(deriveAyFromFy('2024-25'), '2025-26');
  assert.equal(deriveFyFromAy('2025-26'), '2024-25');

  // Both present
  const bothText = 'Financial Year: 2025-26\nAssessment Year: 2026-27';
  const pBoth = extractStatutoryPeriod(bothText);
  assert.equal(pBoth.financial_year, '2025-26');
  assert.equal(pBoth.assessment_year, '2026-27');
  assert.equal(pBoth.warnings.length, 0);

  // Only FY present -> derive AY
  const fyOnly = 'Financial Year: 2025-26';
  const pFy = extractStatutoryPeriod(fyOnly);
  assert.equal(pFy.financial_year, '2025-26');
  assert.equal(pFy.assessment_year, '2026-27');

  // Only AY present -> derive FY
  const ayOnly = 'Assessment Year: 2026-27';
  const pAy = extractStatutoryPeriod(ayOnly);
  assert.equal(pAy.financial_year, '2025-26');
  assert.equal(pAy.assessment_year, '2026-27');

  // Missing year does NOT default to 2026-27
  const noneText = 'Hello world with no tax years';
  const pNone = extractStatutoryPeriod(noneText);
  assert.equal(pNone.financial_year, '');
  assert.equal(pNone.assessment_year, '');
  const periodWarn = pNone.warnings.find(w => w.code === 'PERIOD_NOT_FOUND');
  assert.ok(periodWarn, 'PERIOD_NOT_FOUND warning should be emitted when period is missing');
});

test('6. Document Classification & Form 168 Separation', () => {
  // Current AIS document marker
  const aisText = 'Government of India\nAnnual Information Statement\nPart A - General Information';
  assert.equal(classifyDocumentType(aisText), 'ais');

  // Form No. 168 (Income-tax Act, 2025 future mode) must NOT be classified as current ais
  const form168Text = 'Income-tax Department\nForm No. 168\nAnnual Information Statement';
  const classified168 = classifyDocumentType(form168Text);
  assert.notEqual(classified168, 'ais', 'Form 168 must not be classified as current AY 2026-27 AIS');
  assert.equal(classified168, 'form_168_future');

  // Form 26AS marker
  const f26asText = 'Form 26AS\nAnnual Tax Statement under Section 203AA';
  assert.equal(classifyDocumentType(f26asText), 'form_26as');
});

test('7. StructuredExtractionResult Architecture Alignment', () => {
  const structured = extractStructuredData(OFFICIAL_AIS_FIXTURE);

  // Architecture contract checks
  assert.equal(structured.schema_version, SCHEMA_VERSION);
  assert.equal(structured.itr_routing_rule_version, ITR_ROUTING_RULE_VERSION);
  assert.equal(structured.tax_rule_version, TAX_RULE_VERSION);
  assert.equal(structured.document_type, 'AIS');

  // Envelope checks
  assert.ok(structured.extraction, 'StructuredExtractionResult must include extraction envelope');
  assert.ok(structured.section_statuses, 'StructuredExtractionResult must include section_statuses');
  assert.equal(structured.section_statuses.A, 'extracted');
  assert.equal(structured.section_statuses.B1, 'extracted');
  assert.equal(structured.section_statuses.B2, 'extracted');
  assert.equal(structured.section_statuses.B3, 'extracted');
  assert.equal(structured.section_statuses.B4, 'extracted');
  assert.ok(Array.isArray(structured.warnings));

  // Canonical schema period
  assert.equal(structured.aisJson.financial_year, '2025-26');
  assert.equal(structured.aisJson.assessment_year, '2026-27');
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

  // Ensure neither the extractor nor the schema converts the gross 15L into STCG/LTCG or taxable income
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

test('10. Form 168 is Not Silently Processed as Current AY 2026-27 AIS Mode', () => {
  const form168Doc = `
Income-tax Department
Form No. 168
Annual Information Statement
Tax Year: 2026-27
Part A - Assessee Information
Permanent Account Number: ABCDE1234F
`;

  const structured = extractStructuredData(form168Doc);
  // Must NOT route through current AY 2026-27 AIS extraction
  assert.equal(structured.extraction, null, 'Form 168 must not produce current AY 2026-27 AIS extraction');
  const form168Warning = structured.warnings.find(w => w.code === 'FORM_168_FUTURE_MODE');
  assert.ok(form168Warning, 'Must emit FORM_168_FUTURE_MODE warning');
});
