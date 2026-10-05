import { StructuredExtractionResult } from '../types/ais';

/**
 * Exporter utility for transforming structured extraction results into multiple formats
 */

export function exportToJson(structuredData: StructuredExtractionResult | null, pretty: boolean = true): string {
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
      rows: t.rows.map(r => {
        const copy = { ...r };
        delete copy._rawCells;
        return copy;
      })
    })),
    sections: structuredData.sections
  };

  return pretty ? JSON.stringify(cleanData, null, 2) : JSON.stringify(cleanData);
}

export function exportToCsv(structuredData: StructuredExtractionResult | null): string {
  if (!structuredData) return '';

  const parts: string[] = [];

  // 1. Key-Value Pairs
  parts.push('# KEY-VALUE PAIRS');
  parts.push('Category,Key,Value,Confidence');
  structuredData.flatKeyValues.forEach(kv => {
    parts.push(`"${escapeCsv(kv.category)}","${escapeCsv(kv.key)}","${escapeCsv(kv.value)}","${kv.confidence}%"`);
  });
  parts.push('');

  // 2. Tables
  if (structuredData.tables && structuredData.tables.length > 0) {
    structuredData.tables.forEach((tbl, idx) => {
      parts.push(`# TABLE: ${escapeCsv(tbl.title || `Table ${idx + 1}`)}`);
      parts.push(tbl.headers.map(h => `"${escapeCsv(h)}"`).join(','));
      
      tbl.rows.forEach(row => {
        const rowCells = tbl.headers.map(h => {
          const key = h.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/^_+|_+$/g, '');
          return `"${escapeCsv(row[key] || '')}"`;
        });
        parts.push(rowCells.join(','));
      });
      parts.push('');
    });
  }

  // 3. Entities
  parts.push('# ENTITIES');
  parts.push('Entity Type,Value');
  structuredData.entities.emails.forEach(e => parts.push(`"Email","${escapeCsv(e)}"`));
  structuredData.entities.phones.forEach(p => parts.push(`"Phone","${escapeCsv(p)}"`));
  structuredData.entities.dates.forEach(d => parts.push(`"Date","${escapeCsv(d)}"`));
  structuredData.entities.monetaryAmounts.forEach(m => parts.push(`"Amount","${escapeCsv(m)}"`));
  structuredData.entities.organizations.forEach(o => parts.push(`"Organization","${escapeCsv(o)}"`));
  structuredData.entities.identifiers.forEach(id => parts.push(`"Identifier: ${escapeCsv(id.type)}","${escapeCsv(id.value)}"`));

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
          const key = h.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/^_+|_+$/g, '');
          return row[key] || '';
        });
        md += `| ${cells.join(' | ')} |\n`;
      });
      md += '\n';
    });
  }

  if (structuredData.sections && structuredData.sections.length > 0) {
    md += `## Document Sections\n\n`;
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

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).replace(/"/g, '""');
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
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
