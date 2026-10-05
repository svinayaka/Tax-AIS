import type { StructuredExtractionResult } from '../types/ais';
import { escapeCsv } from './dom-utils';

/**
 * Exporter utility for transforming structured extraction results into multiple formats
 */

export function exportToJson(structuredData: StructuredExtractionResult | null, pretty = true): string {
  if (!structuredData) return '{}';

  if (structuredData.aisJson) {
    return pretty ? JSON.stringify(structuredData.aisJson, null, 2) : JSON.stringify(structuredData.aisJson);
  }

  const cleanData = {
    documentClassification: structuredData.documentClassification,
    summary: structuredData.summary,
    metadata: structuredData.metadata,
    entities: structuredData.entities,
    keyValues: structuredData.flatKeyValues.map(kv => ({
      key: kv.key,
      value: kv.value,
      category: kv.category,
      confidence: kv.confidence
    })),
    tables: structuredData.tables.map(t => ({
      title: t.title,
      headers: t.headers,
      rows: t.rows.map(r => Object.fromEntries(
        Object.entries(r).filter(([k]) => k !== '_rawCells')
      ))
    })),
    sections: structuredData.sections
  };

  return pretty ? JSON.stringify(cleanData, null, 2) : JSON.stringify(cleanData);
}

function sanitizeHeaderKey(header: string): string {
  let key = header.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  while (key.startsWith('_')) {
    key = key.slice(1);
  }
  while (key.endsWith('_')) {
    key = key.slice(0, -1);
  }
  return key;
}

export function exportToCsv(structuredData: StructuredExtractionResult | null): string {
  if (!structuredData) return '';

  const parts: string[] = [];

  // 1. Key-Value Pairs
  const kvRows = structuredData.flatKeyValues.map(
    kv => `"${escapeCsv(kv.category)}","${escapeCsv(kv.key)}","${escapeCsv(kv.value)}","${kv.confidence}%"`
  );
  parts.push(
    '# KEY-VALUE PAIRS',
    'Category,Key,Value,Confidence',
    ...kvRows,
    ''
  );

  // 2. Tables
  if (structuredData.tables && structuredData.tables.length > 0) {
    structuredData.tables.forEach((tbl, idx) => {
      const tableTitle = tbl.title || `Table ${idx + 1}`;
      const headerRow = tbl.headers.map(h => `"${escapeCsv(h)}"`).join(',');
      const dataRows = tbl.rows.map(row => {
        const rowCells = tbl.headers.map(h => {
          const key = sanitizeHeaderKey(h);
          return `"${escapeCsv(row[key] ?? '')}"`;
        });
        return rowCells.join(',');
      });

      parts.push(
        `# TABLE: ${escapeCsv(tableTitle)}`,
        headerRow,
        ...dataRows,
        ''
      );
    });
  }

  // 3. Entities
  parts.push(
    '# ENTITIES',
    'Entity Type,Value',
    ...structuredData.entities.emails.map(e => `"Email","${escapeCsv(e)}"`),
    ...structuredData.entities.phones.map(p => `"Phone","${escapeCsv(p)}"`),
    ...structuredData.entities.dates.map(d => `"Date","${escapeCsv(d)}"`),
    ...structuredData.entities.monetaryAmounts.map(m => `"Amount","${escapeCsv(m)}"`),
    ...structuredData.entities.organizations.map(o => `"Organization","${escapeCsv(o)}"`),
    ...structuredData.entities.identifiers.map(id => `"Identifier: ${escapeCsv(id.type)}","${escapeCsv(id.value)}"`)
  );

  return parts.join('\n');
}

export function exportToMarkdown(structuredData: StructuredExtractionResult | null): string {
  if (!structuredData) return '';

  let md = `# Structured Data Extraction Report\n\n`;
  md += `**Document Type:** ${structuredData.documentClassification.label}\n`;
  md += `**Extracted On:** ${new Date().toLocaleString()}\n`;
  md += `**Confidence Score:** ${structuredData.metadata.confidenceScore}%\n\n`;

  md += `## Executive Summary\n${structuredData.summary.overview}\n\n`;

  md += `## Key Extracted Fields\n\n`;
  for (const [category, items] of Object.entries(structuredData.keyValues)) {
    md += `### ${category}\n`;
    items.forEach(item => {
      md += `- **${item.key}:** ${item.value}\n`;
    });
    md += '\n';
  }

  if (structuredData.tables && structuredData.tables.length > 0) {
    structuredData.tables.forEach(tbl => {
      md += `## Table: ${tbl.title}\n\n`;
      md += `| ${tbl.headers.join(' | ')} |\n`;
      md += `| ${tbl.headers.map(() => '---').join(' | ')} |\n`;
      tbl.rows.forEach(row => {
        const cells = tbl.headers.map(h => {
          const key = sanitizeHeaderKey(h);
          return String(row[key] ?? '');
        });
        md += `| ${cells.join(' | ')} |\n`;
      });
      md += '\n';
    });
  }

  if (structuredData.sections && structuredData.sections.length > 0) {
    structuredData.sections.forEach(sec => {
      md += `### ${sec.title}\n`;
      if (sec.content && sec.content.length > 0) {
        md += `${sec.content.join('\n\n')}\n\n`;
      }
      if (sec.items && sec.items.length > 0) {
        sec.items.forEach(item => {
          md += `- ${item}\n`;
        });
        md += '\n';
      }
    });
  }

  return md;
}

/**
 * Trigger file download in browser
 */
export function downloadFile(content: string, fileName: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
