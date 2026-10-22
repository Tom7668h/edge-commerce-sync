import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDatabase, ID1Database } from './client.js';
import { logger } from '../utils/logger.js';
import { ParserService } from '../services/parser.service.js';
import { BrandMappingService } from '../services/brand-mapping.service.js';
import { PricingService } from '../services/pricing.service.js';

export async function runSeeder(customDb?: ID1Database): Promise<{ seededItems: number; seededRules: number }> {
  const db = customDb || getDatabase();
  logger.info('Starting database seeding...');

  // 1. Seed Brand Mappings
  await db.prepare('DELETE FROM brand_mappings').run();
  const insertBrand = db.prepare(`
    INSERT INTO brand_mappings (raw_pattern, target_brand, is_active, priority)
    VALUES (?, ?, 1, ?)
  `);

  await insertBrand.bind('(?i)^AFTERMARKET.*', 'ApexTruck Pro', 1).run();
  await insertBrand.bind('(?i)^OE-ERSATZ.*', 'NordicPart HeavyDuty', 2).run();
  await insertBrand.bind('(?i)^GENERIC.*', 'OmniCraft Fleet', 3).run();

  // 2. Seed Price Rules
  await db.prepare('DELETE FROM price_rules').run();
  const insertRule = db.prepare(`
    INSERT INTO price_rules (category, min_purchase_price, max_purchase_price, margin_percentage, handling_fee, rounding_mode)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  await insertRule.bind(null, 0.00, 19.99, 55.0, 2.50, 'PSYCHOLOGICAL_99').run();
  await insertRule.bind(null, 20.00, 99.99, 35.0, 4.00, 'PSYCHOLOGICAL_99').run();
  await insertRule.bind(null, 100.00, 499.99, 22.0, 8.00, 'PSYCHOLOGICAL_99').run();
  await insertRule.bind(null, 500.00, 99999.00, 15.0, 15.00, 'PSYCHOLOGICAL_99').run();

  // Fetch created rules
  const brandRules = (await db.prepare('SELECT id, raw_pattern as rawPattern, target_brand as targetBrand, is_active as isActive, priority FROM brand_mappings WHERE is_active = 1 ORDER BY priority ASC').all()).results as any[];
  const priceRules = (await db.prepare('SELECT id, category, min_purchase_price as minPurchasePrice, max_purchase_price as maxPurchasePrice, margin_percentage as marginPercentage, handling_fee as handlingFee, rounding_mode as roundingMode FROM price_rules').all()).results as any[];

  // 3. Ingest Demo CSV
  const csvPaths = [
    resolve(process.cwd(), 'data', 'demo_supplier_feed.csv'),
    resolve(process.cwd(), 'edge-commerce-sync', 'data', 'demo_supplier_feed.csv'),
    resolve(import.meta.dirname ?? '.', '../../data/demo_supplier_feed.csv'),
  ];

  let csvContent = '';
  for (const p of csvPaths) {
    if (existsSync(p)) {
      csvContent = readFileSync(p, 'utf-8');
      break;
    }
  }

  if (!csvContent) {
    logger.warn('Demo CSV file not found for seeding.');
    return { seededItems: 0, seededRules: brandRules.length + priceRules.length };
  }

  const parserService = new ParserService();
  const brandMappingService = new BrandMappingService();
  const pricingService = new PricingService();

  const rawItems = parserService.parseCsv(csvContent);
  await db.prepare('DELETE FROM catalog_items').run();
  await db.prepare('DELETE FROM price_audit_logs').run();

  const insertItem = db.prepare(`
    INSERT INTO catalog_items (
      sku, ean, title, raw_brand, mapped_brand, category, purchase_price, selling_price, margin_percentage, stock, supplier_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  for (const item of rawItems) {
    const mappedBrand = brandMappingService.resolveBrand(item.brand, brandRules);
    const purchasePrice = typeof item.purchasePrice === 'number' ? item.purchasePrice : parseFloat(item.purchasePrice as string);
    const pricing = pricingService.calculateSellingPrice(purchasePrice, item.category, priceRules);
    const stock = typeof item.stock === 'number' ? item.stock : parseInt(item.stock as string, 10) || 0;

    await insertItem.bind(
      item.sku,
      item.ean || null,
      item.title,
      item.brand,
      mappedBrand,
      item.category,
      purchasePrice,
      pricing.sellingPrice,
      pricing.marginPercentage,
      stock,
      item.supplierName
    ).run();

    count++;
  }

  // Seed sample price audit logs to demonstrate anomaly tracking
  const insertAudit = db.prepare(`
    INSERT INTO price_audit_logs (sku, old_purchase_price, new_purchase_price, old_selling_price, new_selling_price, price_delta_percentage, applied_rule_id, change_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  await insertAudit.bind('NFZ-MO-6003', 980.00, 1150.00, 1142.99, 1337.99, 17.35, 4, 'Lieferantenpreiserhöhung Rohstoffzuschlag Garrett').run();
  await insertAudit.bind('NFZ-SN-2001', 240.00, 285.00, 301.99, 355.99, 18.75, 3, 'Preisanpassung Chipmangel NOx Sensoren Continental').run();
  await insertAudit.bind('NFZ-BR-1002', 49.50, 42.80, 71.99, 61.99, -13.54, 2, 'Mengennachlass Lieferant EuroTruck Logistics').run();

  logger.info(`Seeding completed successfully: ${count} catalog items, ${priceRules.length} price rules, ${brandRules.length} brand mappings seeded.`);
  return { seededItems: count, seededRules: brandRules.length + priceRules.length };
}

// Auto-run if executed directly
if (process.argv[1]?.includes('seeder.ts') || process.argv[1]?.includes('seeder.js')) {
  runSeeder().catch((err) => {
    logger.error('Seeding failed', err);
    process.exit(1);
  });
}
