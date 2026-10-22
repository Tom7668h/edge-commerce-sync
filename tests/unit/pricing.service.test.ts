import { describe, it, expect } from 'vitest';
import { PricingService } from '../../src/services/pricing.service.js';
import { PriceRule } from '../../src/models/price-rule.js';

describe('PricingService', () => {
  const pricingService = new PricingService();

  const rules: PriceRule[] = [
    {
      id: 1,
      category: null,
      minPurchasePrice: 0.0,
      maxPurchasePrice: 19.99,
      marginPercentage: 55.0,
      handlingFee: 2.5,
      roundingMode: 'PSYCHOLOGICAL_99',
    },
    {
      id: 2,
      category: null,
      minPurchasePrice: 20.0,
      maxPurchasePrice: 99.99,
      marginPercentage: 35.0,
      handlingFee: 4.0,
      roundingMode: 'PSYCHOLOGICAL_99',
    },
    {
      id: 3,
      category: null,
      minPurchasePrice: 100.0,
      maxPurchasePrice: 499.99,
      marginPercentage: 22.0,
      handlingFee: 8.0,
      roundingMode: 'PSYCHOLOGICAL_99',
    },
  ];

  it('should apply Tier 1 rule for small parts (EK < 20€)', () => {
    // EK: 10.00 -> 10 * 1.55 + 2.50 = 18.00 -> 18.99
    const result = pricingService.calculateSellingPrice(10.0, 'Filter', rules);
    expect(result.appliedRuleId).toBe(1);
    expect(result.sellingPrice).toBe(18.99);
    expect(result.netMarginEur).toBe(8.99);
    expect(result.sellingPriceGross).toBe(22.6); // 18.99 * 1.19 = 22.5981 -> 22.60
  });

  it('should apply Tier 2 rule for mid-range parts (20€ - 100€)', () => {
    // EK: 50.00 -> 50 * 1.35 + 4.00 = 71.50 -> 71.99
    const result = pricingService.calculateSellingPrice(50.0, 'Bremsen', rules);
    expect(result.appliedRuleId).toBe(2);
    expect(result.sellingPrice).toBe(71.99);
    expect(result.netMarginEur).toBe(21.99);
  });

  it('should apply psychological rounding .99', () => {
    const customRules: PriceRule[] = [
      {
        id: 10,
        category: null,
        minPurchasePrice: 0,
        maxPurchasePrice: 1000,
        marginPercentage: 20.0,
        handlingFee: 0,
        roundingMode: 'PSYCHOLOGICAL_99',
      },
    ];

    // EK 20.00 -> 24.00 -> 24.99
    const res = pricingService.calculateSellingPrice(20.0, 'Allgemein', customRules);
    expect(res.sellingPrice).toBe(24.99);
  });

  it('should support EXACT rounding mode', () => {
    const exactRules: PriceRule[] = [
      {
        id: 20,
        category: null,
        minPurchasePrice: 0,
        maxPurchasePrice: 1000,
        marginPercentage: 25.0,
        handlingFee: 2.15,
        roundingMode: 'EXACT',
      },
    ];

    // EK 10.00 -> 10 * 1.25 + 2.15 = 14.65
    const res = pricingService.calculateSellingPrice(10.0, 'Allgemein', exactRules);
    expect(res.sellingPrice).toBe(14.65);
  });
});
