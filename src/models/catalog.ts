export interface RawSupplierItem {
  sku: string;
  ean?: string;
  title: string;
  brand: string;
  category: string;
  purchasePrice: number | string;
  stock: number | string;
  supplierName: string;
}

export interface NormalizedCatalogItem {
  id?: number;
  sku: string;
  ean: string | null;
  title: string;
  rawBrand: string;
  mappedBrand: string;
  category: string;
  purchasePrice: number;
  sellingPrice: number;
  marginPercentage: number;
  stock: number;
  supplierName: string;
  lastImportedAt?: string;
  updatedAt?: string;
}

export interface PriceAuditLog {
  id?: number;
  sku: string;
  oldPurchasePrice: number | null;
  newPurchasePrice: number;
  oldSellingPrice: number | null;
  newSellingPrice: number;
  priceDeltaPercentage: number;
  appliedRuleId: number | null;
  changeReason: string;
  loggedAt?: string;
}

export interface IngestSummary {
  jobId: string;
  total: number;
  processed: number;
  updated: number;
  inserted: number;
  failed: number;
  anomaliesCount: number;
  durationMs: number;
}
