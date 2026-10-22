import { BrandMappingRule } from '../models/price-rule.js';
import { logger } from '../utils/logger.js';

export class BrandMappingService {
  /**
   * Resolves raw brand string to target brand using prioritized regex rules.
   */
  resolveBrand(rawBrand: string, rules: BrandMappingRule[]): string {
    if (!rawBrand || !rawBrand.trim()) {
      return 'Generic';
    }

    const trimmedBrand = rawBrand.trim();

    // Sort rules by priority ascending (1 = highest priority)
    const sortedRules = [...rules].filter((r) => r.isActive).sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
      try {
        let patternStr = rule.rawPattern;
        let flags = '';

        // Handle inline regex case-insensitive flag (?i)
        if (patternStr.startsWith('(?i)')) {
          flags += 'i';
          patternStr = patternStr.substring(4);
        }

        const regex = new RegExp(patternStr, flags);
        if (regex.test(trimmedBrand)) {
          return rule.targetBrand;
        }
      } catch (err) {
        logger.warn(`Invalid regex pattern in brand mapping rule ID ${rule.id}: ${rule.rawPattern}`, { err });
      }
    }

    return trimmedBrand;
  }
}
