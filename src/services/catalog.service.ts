import { ID1Database } from '../db/client.js';
import { RawSupplierItem, IngestSummary, NormalizedCatalogItem } from '../models/catalog.js';
import { BrandMappingRule, PriceRule } from '../models/price-rule.js';
import { BrandMappingService } from './brand-mapping.service.js';
import { PricingService } from './pricing.service.js';
import { APP_CONFIG } from '../config/constants.js';
import { logger } from '../utils/logger.js';

export class CatalogService {
  private brandService: BrandMappingService;
  private pricingService: PricingService;

  constructor() {
    this.brandService = new BrandMappingService();
    this.pricingService = new PricingService();
  }

  async processBatch(items: RawSupplierItem[], db: ID1Database, sourceType: string = 'CSV'): Promise<IngestSummary> {
    const startTime = Date.now();
    const jobId = `JOB-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // 1. Fetch active rules
    const brandRules = (
      await db
        .prepare('SELECT id, raw_pattern as rawPattern, target_brand as targetBrand, is_active as isActive, priority FROM brand_mappings WHERE is_active = 1 ORDER BY priority ASC')
        .all<BrandMappingRule>()
    ).results;

    const priceRules = (
      await db
        .prepare('SELECT id, category, min_purchase_price as minPurchasePrice, max_purchase_price as maxPurchasePrice, margin_percentage as marginPercentage, handling_fee as handlingFee, rounding_mode as roundingMode FROM price_rules')
        .all<PriceRule>()
    ).results;

    let inserted = 0;
    let updated = 0;
    let failed = 0;
    let anomaliesCount = 0;

    const selectItemStmt = db.prepare('SELECT * FROM catalog_items WHERE sku = ?');
    const updateItemStmt = db.prepare(`
      UPDATE catalog_items
      SET ean = ?, title = ?, raw_brand = ?, mapped_brand = ?, category = ?, purchase_price = ?, selling_price = ?, margin_percentage = ?, stock = ?, supplier_name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE sku = ?
    `);
    const insertItemStmt = db.prepare(`
      INSERT INTO catalog_items (sku, ean, title, raw_brand, mapped_brand, category, purchase_price, selling_price, margin_percentage, stock, supplier_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertAuditStmt = db.prepare(`
      INSERT INTO price_audit_logs (sku, old_purchase_price, new_purchase_price, old_selling_price, new_selling_price, price_delta_percentage, applied_rule_id, change_reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const raw of items) {
      try {
        const purchasePrice = typeof raw.purchasePrice === 'number' ? raw.purchasePrice : parseFloat(raw.purchasePrice as string) || 0;
        const mappedBrand = this.brandService.resolveBrand(raw.brand, brandRules);
        const pricing = this.pricingService.calculateSellingPrice(purchasePrice, raw.category, priceRules);
        const stock = typeof raw.stock === 'number' ? raw.stock : parseInt(raw.stock as string, 10) || 0;

        const existing = await selectItemStmt.bind(raw.sku).first<Record<string, any>>();

        if (existing) {
          const oldPurchasePrice = Number(existing.purchase_price);
          const oldSellingPrice = Number(existing.selling_price);

          // Check for price changes
          if (oldPurchasePrice !== purchasePrice || oldSellingPrice !== pricing.sellingPrice) {
            const priceDeltaPct =
              oldPurchasePrice > 0
                ? Math.round(((purchasePrice - oldPurchasePrice) / oldPurchasePrice) * 10000) / 100
                : 100.0;

            if (Math.abs(priceDeltaPct) >= APP_CONFIG.PRICE_ANOMALY_THRESHOLD_PCT) {
              anomaliesCount++;
              await insertAuditStmt.bind(
                raw.sku,
                oldPurchasePrice,
                purchasePrice,
                oldSellingPrice,
                pricing.sellingPrice,
                priceDeltaPct,
                pricing.appliedRuleId,
                `Automatische Preisanpassung (Delta: ${priceDeltaPct > 0 ? '+' : ''}${priceDeltaPct}%) via ${sourceType}`
              ).run();
            }
          }

          await updateItemStmt.bind(
            raw.ean || null,
            raw.title,
            raw.brand,
            mappedBrand,
            raw.category,
            purchasePrice,
            pricing.sellingPrice,
            pricing.marginPercentage,
            stock,
            raw.supplierName,
            raw.sku
          ).run();

          updated++;
        } else {
          await insertItemStmt.bind(
            raw.sku,
            raw.ean || null,
            raw.title,
            raw.brand,
            mappedBrand,
            raw.category,
            purchasePrice,
            pricing.sellingPrice,
            pricing.marginPercentage,
            stock,
            raw.supplierName
          ).run();

          inserted++;
        }
      } catch (err) {
        failed++;
        logger.error(`Error processing item ${raw.sku}`, err);
      }
    }

    const durationMs = Date.now() - startTime;

    // Log import job
    await db.prepare(`
      INSERT INTO import_jobs (id, source_type, total_records, processed_records, failed_records, status, duration_ms)
      VALUES (?, ?, ?, ?, ?, 'COMPLETED', ?)
    `).bind(jobId, sourceType, items.length, inserted + updated, failed, durationMs).run();

    return {
      jobId,
      total: items.length,
      processed: inserted + updated,
      inserted,
      updated,
      failed,
      anomaliesCount,
      durationMs,
    };
  }

  async getCatalogItems(
    db: ID1Database,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      brand?: string;
      category?: string;
      minStock?: number;
    }
  ): Promise<{ items: NormalizedCatalogItem[]; total: number; page: number; totalPages: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(APP_CONFIG.MAX_PAGE_SIZE, Math.max(1, options.limit || APP_CONFIG.DEFAULT_PAGE_SIZE));
    const offset = (page - 1) * limit;

    let whereClauses: string[] = [];
    let params: unknown[] = [];

    if (options.search && options.search.trim()) {
      whereClauses.push('(sku LIKE ? OR title LIKE ? OR mapped_brand LIKE ?)');
      const term = `%${options.search.trim()}%`;
      params.push(term, term, term);
    }

    if (options.brand && options.brand.trim() && options.brand !== 'ALL') {
      whereClauses.push('mapped_brand = ?');
      params.push(options.brand.trim());
    }

    if (options.category && options.category.trim() && options.category !== 'ALL') {
      whereClauses.push('category = ?');
      params.push(options.category.trim());
    }

    if (options.minStock !== undefined && !isNaN(options.minStock)) {
      whereClauses.push('stock >= ?');
      params.push(options.minStock);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) as cnt FROM catalog_items ${whereSql}`;
    const countRow = await db.prepare(countQuery).bind(...params).first<{ cnt: number }>();
    const total = countRow?.cnt || 0;

    const dataQuery = `
      SELECT
        id, sku, ean, title, raw_brand as rawBrand, mapped_brand as mappedBrand,
        category, purchase_price as purchasePrice, selling_price as sellingPrice,
        margin_percentage as marginPercentage, stock, supplier_name as supplierName,
        last_imported_at as lastImportedAt, updated_at as updatedAt
      FROM catalog_items
      ${whereSql}
      ORDER BY id ASC
      LIMIT ? OFFSET ?
    `;

    const dataRows = (await db.prepare(dataQuery).bind(...params, limit, offset).all<NormalizedCatalogItem>()).results;

    return {
      items: dataRows,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getCatalogItemBySku(db: ID1Database, sku: string): Promise<{ item: NormalizedCatalogItem | null; priceHistory: any[] }> {
    const item = await db
      .prepare(`
        SELECT
          id, sku, ean, title, raw_brand as rawBrand, mapped_brand as mappedBrand,
          category, purchase_price as purchasePrice, selling_price as sellingPrice,
          margin_percentage as marginPercentage, stock, supplier_name as supplierName,
          last_imported_at as lastImportedAt, updated_at as updatedAt
        FROM catalog_items
        WHERE sku = ?
      `)
      .bind(sku)
      .first<NormalizedCatalogItem>();

    if (!item) {
      return { item: null, priceHistory: [] };
    }

    const priceHistory = (
      await db
        .prepare(`
          SELECT
            id, sku, old_purchase_price as oldPurchasePrice, new_purchase_price as newPurchasePrice,
            old_selling_price as oldSellingPrice, new_selling_price as newSellingPrice,
            price_delta_percentage as priceDeltaPercentage, applied_rule_id as appliedRuleId,
            change_reason as changeReason, logged_at as loggedAt
          FROM price_audit_logs
          WHERE sku = ?
          ORDER BY logged_at DESC
        `)
        .bind(sku)
        .all()
    ).results;

    return { item, priceHistory };
  }
}
