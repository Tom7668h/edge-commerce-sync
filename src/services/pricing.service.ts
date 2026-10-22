import { PriceRule, PriceCalculationResult } from '../models/price-rule.js';
import { APP_CONFIG, ROUNDING_MODES, RoundingMode } from '../config/constants.js';

export class PricingService {
  /**
   * Calculates optimal selling price based on tiered margin rules and psychological rounding.
   */
  calculateSellingPrice(purchasePrice: number, category: string, rules: PriceRule[]): PriceCalculationResult {
    const sanitizedEK = Math.max(0, purchasePrice);

    // 1. Find matching rule (category-specific rule takes precedence over global null-category rule)
    const matchingRule =
      rules.find(
        (r) =>
          r.category &&
          r.category.toLowerCase() === category.toLowerCase() &&
          sanitizedEK >= r.minPurchasePrice &&
          sanitizedEK <= r.maxPurchasePrice
      ) ||
      rules.find((r) => !r.category && sanitizedEK >= r.minPurchasePrice && sanitizedEK <= r.maxPurchasePrice) ||
      this.getDefaultFallbackRule(sanitizedEK);

    // 2. Base formula: EK * (1 + margin / 100) + handling
    const rawSellingPrice = sanitizedEK * (1 + matchingRule.marginPercentage / 100) + matchingRule.handlingFee;

    // 3. Apply psychological / configured rounding
    const finalSellingPrice = this.applyRounding(rawSellingPrice, matchingRule.roundingMode);

    // 4. Calculate actual profit and margin percentage
    const netMarginEur = Math.round((finalSellingPrice - sanitizedEK) * 100) / 100;
    const marginPercentage =
      finalSellingPrice > 0 ? Math.round(((finalSellingPrice - sanitizedEK) / finalSellingPrice) * 10000) / 100 : 0;

    const sellingPriceGross = Math.round(finalSellingPrice * (1 + APP_CONFIG.VAT_RATE) * 100) / 100;

    return {
      sellingPrice: finalSellingPrice,
      sellingPriceGross,
      marginPercentage,
      netMarginEur,
      appliedRuleId: matchingRule.id,
    };
  }

  private applyRounding(price: number, mode: RoundingMode): number {
    switch (mode) {
      case ROUNDING_MODES.PSYCHOLOGICAL_99: {
        const floor = Math.floor(price);
        return Math.max(0.99, floor + 0.99);
      }
      case ROUNDING_MODES.PSYCHOLOGICAL_49: {
        const floor = Math.floor(price);
        return Math.max(0.49, floor + 0.49);
      }
      case ROUNDING_MODES.NEAREST_HALF: {
        return Math.round(price * 2) / 2;
      }
      case ROUNDING_MODES.EXACT:
      default: {
        return Math.round(price * 100) / 100;
      }
    }
  }

  private getDefaultFallbackRule(price: number): PriceRule {
    return {
      id: 999,
      category: null,
      minPurchasePrice: 0,
      maxPurchasePrice: 999999,
      marginPercentage: 30.0,
      handlingFee: 3.5,
      roundingMode: ROUNDING_MODES.PSYCHOLOGICAL_99,
    };
  }
}
