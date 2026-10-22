import { describe, it, expect } from 'vitest';
import { BrandMappingService } from '../../src/services/brand-mapping.service.js';
import { BrandMappingRule } from '../../src/models/price-rule.js';

describe('BrandMappingService', () => {
  const brandService = new BrandMappingService();

  const rules: BrandMappingRule[] = [
    {
      id: 1,
      rawPattern: '(?i)^AFTERMARKET.*',
      targetBrand: 'ApexTruck Pro',
      isActive: true,
      priority: 1,
    },
    {
      id: 2,
      rawPattern: '(?i)^OE-ERSATZ.*',
      targetBrand: 'NordicPart HeavyDuty',
      isActive: true,
      priority: 2,
    },
    {
      id: 3,
      rawPattern: '(?i)^GENERIC.*',
      targetBrand: 'OmniCraft Fleet',
      isActive: true,
      priority: 3,
    },
  ];

  it('should map regex matching supplier brands to target brand', () => {
    expect(brandService.resolveBrand('AFTERMARKET-LINE', rules)).toBe('ApexTruck Pro');
    expect(brandService.resolveBrand('aftermarket_economy', rules)).toBe('ApexTruck Pro');
    expect(brandService.resolveBrand('OE-ERSATZ-PRO', rules)).toBe('NordicPart HeavyDuty');
    expect(brandService.resolveBrand('GENERIC_HD', rules)).toBe('OmniCraft Fleet');
  });

  it('should retain original brand if no rule matches', () => {
    expect(brandService.resolveBrand('Bosch', rules)).toBe('Bosch');
    expect(brandService.resolveBrand('Knorr-Bremse', rules)).toBe('Knorr-Bremse');
  });

  it('should fallback to Generic for empty or null strings', () => {
    expect(brandService.resolveBrand('', rules)).toBe('Generic');
    expect(brandService.resolveBrand('   ', rules)).toBe('Generic');
  });
});
