import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractStructuredData } from '../../src/lib/extractor';
import { classifyItr } from '../../src/lib/itr-classifier';
import type { AisDeveloperSchema, StructuredExtractionResult } from '../../src/types/ais';

async function extractTextFromPdf(pdfPath: string): Promise<string> {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  let fullText = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((it: any) => it.str);
    fullText += strings.join('\n') + '\n';
  }
  return fullText;
}

test('Integration 1: ITR-1 Basic AIS PDF Extraction & Statutory Classification', async () => {
  const fixtureDir = path.resolve(process.cwd(), 'tests/fixtures/ais/itr1');
  const pdfPath = path.join(fixtureDir, 'ais-itr1-basic.pdf');
  const expectedPath = path.join(fixtureDir, 'expected.json');

  assert.ok(fs.existsSync(pdfPath), 'ITR-1 PDF fixture must exist');
  assert.ok(fs.existsSync(expectedPath), 'ITR-1 expected JSON must exist');

  const expectedData = JSON.parse(fs.readFileSync(expectedPath, 'utf-8'));
  const extractedText = await extractTextFromPdf(pdfPath);

  const structured: StructuredExtractionResult = extractStructuredData(extractedText);
  assert.ok(structured.extraction, 'Extraction envelope must be present');
  const extraction: AisDeveloperSchema = structured.extraction;

  // Schema matching
  assert.equal(structured.document_type, expectedData.document_type);
  assert.equal(extraction.financial_year, expectedData.extraction.financial_year);
  assert.equal(extraction.assessment_year, expectedData.extraction.assessment_year);
  assert.equal(extraction.part_a_general_info.pan, expectedData.extraction.part_a_general_info.pan);
  assert.equal(extraction.part_a_general_info.name_of_assessee, expectedData.extraction.part_a_general_info.name_of_assessee);
  assert.equal(extraction.part_b1_tds_tcs_transactions.length, expectedData.extraction.part_b1_tds_tcs_transactions.length);
  assert.equal(extraction.part_b2_sft_transactions.length, 0);
  assert.equal(extraction.part_b3_tax_payments.length, expectedData.extraction.part_b3_tax_payments.length);

  // Statutory ITR Form Classification
  const itr = classifyItr(structured);
  assert.equal(itr.recommendedForm, 'ITR-1');
  assert.equal(itr.targetWorkspace, 'ITR-1');
  assert.equal(itr.isBarredFromItr1, false);
  assert.equal(itr.detectedFactors.hasCapitalGains, false);
  assert.equal(itr.detectedFactors.hasSalaryIncome, true);
  assert.equal(itr.detectedFactors.hasInterestIncome, true);
  assert.equal(itr.detectedFactors.hasForeignRemittance, false);
});

test('Integration 2: ITR-2 Capital Gains Signal AIS PDF Extraction & Statutory Routing', async () => {
  const fixtureDir = path.resolve(process.cwd(), 'tests/fixtures/ais/itr2');
  const pdfPath = path.join(fixtureDir, 'ais-itr2-capital-gain-signal.pdf');
  const expectedPath = path.join(fixtureDir, 'expected.json');

  assert.ok(fs.existsSync(pdfPath), 'ITR-2 PDF fixture must exist');
  assert.ok(fs.existsSync(expectedPath), 'ITR-2 expected JSON must exist');

  const expectedData = JSON.parse(fs.readFileSync(expectedPath, 'utf-8'));
  const extractedText = await extractTextFromPdf(pdfPath);

  const structured: StructuredExtractionResult = extractStructuredData(extractedText);
  assert.ok(structured.extraction, 'Extraction envelope must be present');
  const extraction: AisDeveloperSchema = structured.extraction;

  // Schema matching
  assert.equal(structured.document_type, expectedData.document_type);
  assert.equal(extraction.financial_year, expectedData.extraction.financial_year);
  assert.equal(extraction.assessment_year, expectedData.extraction.assessment_year);
  assert.equal(extraction.part_a_general_info.pan, expectedData.extraction.part_a_general_info.pan);
  assert.equal(extraction.part_a_general_info.name_of_assessee, expectedData.extraction.part_a_general_info.name_of_assessee);
  assert.equal(extraction.part_b1_tds_tcs_transactions.length, 1);
  assert.equal(extraction.part_b2_sft_transactions.length, 1);
  assert.equal(extraction.part_b2_sft_transactions[0].information_code, 'SFT-017');
  assert.equal(extraction.part_b2_sft_transactions[0].amount, 550000);
  assert.equal(extraction.part_b3_tax_payments.length, 1);
  assert.equal(extraction.part_b4_demand_refunds.length, 1);

  // Statutory ITR Form Classification
  const itr = classifyItr(structured);
  assert.equal(itr.recommendedForm, 'ITR-2');
  assert.equal(itr.targetWorkspace, 'ITR-2');
  assert.equal(itr.isBarredFromItr1, true);
  assert.equal(itr.detectedFactors.hasCapitalGains, true);
  assert.ok(
    itr.routingTriggers.some(t => t.includes('Capital Gains/Losses footprint detected')),
    'Must include statutory capital gains routing trigger'
  );
});
