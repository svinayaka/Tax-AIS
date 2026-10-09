/**
 * AIS Rule Configuration Loader
 * Imports, validates, and exposes bundled declarative rule configurations.
 *
 * Invariants:
 * - 100% in-browser / zero remote fetch.
 * - Enforces schema validation on bundled JSON rules.
 * - Throws explicit descriptive errors on malformed rule config without fabricated defaults.
 * - Never logs taxpayer information.
 */

import rawPartARules from '../rules/ais/ais-part-a.json';
import rawPartBRules from '../rules/ais/ais-part-b.json';
import type { AisPartARules, AisPartBRules, AisParserId } from '../types/ais-rules';

const VALID_PARSER_IDS: Set<string> = new Set<AisParserId>([
  'partA',
  'partB1',
  'partB2',
  'partB3',
  'partB4'
]);

function validatePartAConfig(raw: unknown): AisPartARules {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Malformed AIS Part A rules: Root must be a non-null object.');
  }
  const config = raw as Partial<AisPartARules>;

  if (typeof config.rulesetVersion !== 'string' || !config.rulesetVersion) {
    throw new Error('Malformed AIS Part A rules: Missing or invalid rulesetVersion.');
  }
  if (config.statutoryRegime !== 'ITA_1961') {
    throw new Error('Malformed AIS Part A rules: Expected statutoryRegime "ITA_1961".');
  }
  if (config.part !== 'A') {
    throw new Error('Malformed AIS Part A rules: Expected part property to be "A".');
  }
  if (!config.sectionDetection || !Array.isArray(config.sectionDetection.startMarkers)) {
    throw new Error('Malformed AIS Part A rules: Missing sectionDetection startMarkers.');
  }
  if (!config.fields || typeof config.fields !== 'object') {
    throw new Error('Malformed AIS Part A rules: Missing fields dictionary.');
  }
  if (!config.failurePolicy || typeof config.failurePolicy !== 'object') {
    throw new Error('Malformed AIS Part A rules: Missing failurePolicy configuration.');
  }

  return raw as AisPartARules;
}

function validatePartBConfig(raw: unknown): AisPartBRules {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Malformed AIS Part B rules: Root must be a non-null object.');
  }
  const config = raw as Partial<AisPartBRules>;

  if (typeof config.rulesetVersion !== 'string' || !config.rulesetVersion) {
    throw new Error('Malformed AIS Part B rules: Missing or invalid rulesetVersion.');
  }
  if (config.statutoryRegime !== 'ITA_1961') {
    throw new Error('Malformed AIS Part B rules: Expected statutoryRegime "ITA_1961".');
  }
  if (config.part !== 'B') {
    throw new Error('Malformed AIS Part B rules: Expected part property to be "B".');
  }
  if (!config.sectionDetection || typeof config.sectionDetection.sectionPattern !== 'string') {
    throw new Error('Malformed AIS Part B rules: Missing sectionDetection.sectionPattern.');
  }
  if (!config.sections || typeof config.sections !== 'object') {
    throw new Error('Malformed AIS Part B rules: Missing sections configuration.');
  }

  for (const [secKey, secVal] of Object.entries(config.sections)) {
    if (!secVal || typeof secVal !== 'object') {
      throw new Error(`Malformed AIS Part B section "${secKey}": Must be an object.`);
    }
    if (!VALID_PARSER_IDS.has(secVal.parser)) {
      throw new Error(`Malformed AIS Part B section "${secKey}": Invalid parser ID "${secVal.parser}".`);
    }
  }

  if (!config.unknownSection || typeof config.unknownSection !== 'object') {
    throw new Error('Malformed AIS Part B rules: Missing unknownSection policy.');
  }
  if (!config.failurePolicy || typeof config.failurePolicy !== 'object') {
    throw new Error('Malformed AIS Part B rules: Missing failurePolicy configuration.');
  }

  return raw as AisPartBRules;
}

// Cached singleton validated rule objects
let cachedPartARules: AisPartARules | null = null;
let cachedPartBRules: AisPartBRules | null = null;

export function getAisPartARules(): AisPartARules {
  if (!cachedPartARules) {
    cachedPartARules = validatePartAConfig(rawPartARules);
  }
  return cachedPartARules;
}

export function getAisPartBRules(): AisPartBRules {
  if (!cachedPartBRules) {
    cachedPartBRules = validatePartBConfig(rawPartBRules);
  }
  return cachedPartBRules;
}

export function getAisRulesetVersion(): string {
  const partA = getAisPartARules();
  const partB = getAisPartBRules();

  if (partA.rulesetVersion !== partB.rulesetVersion) {
    throw new Error(
      'AIS rule configuration version mismatch between Part A and Part B.'
    );
  }

  return partA.rulesetVersion;
}

/**
 * Exposed for unit testing rule validation errors
 */
export function validateAisRulesForTesting(rawA: unknown, rawB: unknown): {
  partA: AisPartARules;
  partB: AisPartBRules;
} {
  return {
    partA: validatePartAConfig(rawA),
    partB: validatePartBConfig(rawB)
  };
}
