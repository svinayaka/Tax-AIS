/**
 * AIS Section Detector
 * Deterministically scans document text according to machine-readable rules
 * to identify Part A and all numbered Part Bn section boundaries.
 *
 * Invariants:
 * - Discovers all Part B([0-9]+) sections physically present in the text.
 * - Categorizes sections as known & supported, known & unsupported, or unknown.
 * - Unknown sections (e.g. B5, B6, B7) are preserved as structural metadata with
 *   status 'unsupported' and are NEVER routed into B1/B2/B3/B4 parsers.
 */

import type {
  AisPartARules,
  AisPartBRules,
  AisSectionDetectionResult,
  DetectedAisSection
} from '../types/ais-rules';

interface RawSectionMarker {
  id: string;
  sectionNumber: number;
  startIndex: number;
  heading: string;
}

function findPartASection(
  text: string,
  rules: AisPartARules,
  firstPartBIndex: number
): DetectedAisSection | null {
  const lower = text.toLowerCase();
  let bestStart = -1;

  for (const marker of rules.sectionDetection.startMarkers) {
    const idx = lower.indexOf(marker.toLowerCase());
    if (idx !== -1 && (bestStart === -1 || idx < bestStart)) {
      bestStart = idx;
    }
  }

  if (bestStart === -1) {
    return null;
  }

  let partAEnd = firstPartBIndex !== -1 ? firstPartBIndex : text.length;

  // Check endMarkers if firstPartBIndex not found
  if (firstPartBIndex === -1) {
    for (const marker of rules.sectionDetection.endMarkers) {
      const idx = lower.indexOf(marker.toLowerCase(), bestStart);
      if (idx !== -1 && idx < partAEnd) {
        partAEnd = idx;
      }
    }
  }

  return {
    id: 'A',
    part: 'A',
    rawText: text.slice(bestStart, partAEnd),
    startIndex: bestStart,
    endIndex: partAEnd,
    supported: true,
    status: 'extracted',
    parserId: 'partA',
    heading: 'Part A - General Information'
  };
}

function discoverRawPartBMarkers(text: string, patternStr: string): RawSectionMarker[] {
  // Use case-insensitive pattern with lowercase character class to comply with SonarJS rules
  const regex = new RegExp(`(?:^|\\n)\\s*(${patternStr.toLowerCase()}[^\\n]*)`, 'gi');
  const markers: RawSectionMarker[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const heading = match[1].trim();
    const numMatch = heading.match(/part\s+b(\d+)/i);
    if (numMatch) {
      const sectionNumber = Number.parseInt(numMatch[1], 10);
      markers.push({
        id: `B${sectionNumber}`,
        sectionNumber,
        startIndex: match.index,
        heading
      });
    }
  }

  return markers;
}

function buildPartBSections(
  text: string,
  markers: RawSectionMarker[],
  rules: AisPartBRules
): DetectedAisSection[] {
  const sections: DetectedAisSection[] = [];

  for (let i = 0; i < markers.length; i++) {
    const cur = markers[i];
    const nextStart = i + 1 < markers.length ? markers[i + 1].startIndex : text.length;
    const rawText = text.slice(cur.startIndex, nextStart);

    const knownConfig = rules.sections[cur.id];

    if (knownConfig) {
      sections.push({
        id: cur.id,
        part: 'B',
        sectionNumber: cur.sectionNumber,
        rawText,
        startIndex: cur.startIndex,
        endIndex: nextStart,
        supported: knownConfig.supported,
        status: knownConfig.supported ? 'extracted' : rules.unknownSection.status,
        parserId: knownConfig.supported ? knownConfig.parser : undefined,
        heading: cur.heading
      });
    } else {
      // Discovered numbered section not in configured supported sections (e.g. B7)
      sections.push({
        id: cur.id,
        part: 'B',
        sectionNumber: cur.sectionNumber,
        rawText,
        startIndex: cur.startIndex,
        endIndex: nextStart,
        supported: false,
        status: rules.unknownSection.status,
        heading: cur.heading
      });
    }
  }

  return sections;
}

/**
 * Detects all AIS sections in the provided normalized document text
 */
export function detectAisSections(
  text: string,
  partARules: AisPartARules,
  partBRules: AisPartBRules
): AisSectionDetectionResult {
  const rawMarkers = discoverRawPartBMarkers(text, partBRules.sectionDetection.sectionPattern);
  const firstPartBIndex = rawMarkers.length > 0 ? rawMarkers[0].startIndex : -1;

  const partA = findPartASection(text, partARules, firstPartBIndex);
  const partBSections = buildPartBSections(text, rawMarkers, partBRules);

  const allDiscoveredSections: DetectedAisSection[] = [];
  if (partA) {
    allDiscoveredSections.push(partA);
  }
  allDiscoveredSections.push(...partBSections);

  return {
    partA,
    partBSections,
    allDiscoveredSections
  };
}
