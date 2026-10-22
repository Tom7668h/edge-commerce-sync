import { RoundingMode } from '../config/constants.js';

export interface PriceRule {
  id: number;
  category: string | null;
  minPurchasePrice: number;
  maxPurchasePrice: number;
  marginPercentage: number;
  handlingFee: number;
  roundingMode: RoundingMode;
}

export interface BrandMappingRule {
  id: number;
  rawPattern: string;
  targetBrand: string;
  isActive: boolean;
  priority: number;
}

export interface PriceCalculationResult {
  sellingPrice: number;
  sellingPriceGross: number; // inkl. 19% MwSt
  marginPercentage: number;
  netMarginEur: number;
  appliedRuleId: number;
}
