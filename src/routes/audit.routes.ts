import { Hono } from 'hono';
import { getDatabase } from '../db/client.js';

type Bindings = {
  DB?: unknown;
};

export const auditRoutes = new Hono<{ Bindings: Bindings }>();

auditRoutes.get('/logs', async (c) => {
  const db = getDatabase(c.env?.DB);
  const limit = parseInt(c.req.query('limit') || '50', 10);

  const logs = (
    await db
      .prepare(`
        SELECT
          l.id, l.sku, l.old_purchase_price as oldPurchasePrice, l.new_purchase_price as newPurchasePrice,
          l.old_selling_price as oldSellingPrice, l.new_selling_price as newSellingPrice,
          l.price_delta_percentage as priceDeltaPercentage, l.applied_rule_id as appliedRuleId,
          l.change_reason as changeReason, l.logged_at as loggedAt,
          c.title, c.mapped_brand as brand
        FROM price_audit_logs l
        LEFT JOIN catalog_items c ON l.sku = c.sku
        ORDER BY l.logged_at DESC
        LIMIT ?
      `)
      .bind(limit)
      .all()
  ).results;

  return c.json({
    success: true,
    logs,
  });
});

auditRoutes.get('/summary', async (c) => {
  const db = getDatabase(c.env?.DB);

  const kpis = await db
    .prepare(`
      SELECT
        COUNT(*) as totalSkus,
        COALESCE(SUM(stock), 0) as totalStockUnits,
        COALESCE(ROUND(SUM(stock * purchase_price), 2), 0) as totalPurchaseValue,
        COALESCE(ROUND(SUM(stock * selling_price), 2), 0) as totalSellingValue,
        COALESCE(ROUND(AVG(margin_percentage), 1), 0) as avgMarginPct
      FROM catalog_items
    `)
    .first<any>();

  const anomalies = await db
    .prepare(`
      SELECT COUNT(*) as cnt
      FROM price_audit_logs
      WHERE ABS(price_delta_percentage) >= 15.0
    `)
    .first<{ cnt: number }>();

  const recentJobs = (
    await db
      .prepare(`
        SELECT id, source_type as sourceType, total_records as total,
               processed_records as processed, status, duration_ms as durationMs, created_at as createdAt
        FROM import_jobs
        ORDER BY created_at DESC
        LIMIT 5
      `)
      .all()
  ).results;

  return c.json({
    success: true,
    stats: {
      totalSkus: kpis?.totalSkus || 0,
      totalStockUnits: kpis?.totalStockUnits || 0,
      totalPurchaseValue: kpis?.totalPurchaseValue || 0,
      totalSellingValue: kpis?.totalSellingValue || 0,
      avgMarginPct: kpis?.avgMarginPct || 0,
      anomaliesCount: anomalies?.cnt || 0,
    },
    recentJobs,
  });
});
