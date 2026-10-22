import { Hono } from 'hono';
import { CatalogService } from '../services/catalog.service.js';
import { getDatabase } from '../db/client.js';

type Bindings = {
  DB?: unknown;
};

export const catalogRoutes = new Hono<{ Bindings: Bindings }>();
const catalogService = new CatalogService();

catalogRoutes.get('/', async (c) => {
  const db = getDatabase(c.env?.DB);
  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = parseInt(c.req.query('limit') || '15', 10);
  const search = c.req.query('search') || '';
  const brand = c.req.query('brand') || '';
  const category = c.req.query('category') || '';
  const minStock = c.req.query('minStock') ? parseInt(c.req.query('minStock')!, 10) : undefined;

  const result = await catalogService.getCatalogItems(db, {
    page,
    limit,
    search,
    brand,
    category,
    minStock,
  });

  return c.json({
    success: true,
    ...result,
  });
});

catalogRoutes.get('/categories', async (c) => {
  const db = getDatabase(c.env?.DB);
  const rows = (await db.prepare('SELECT DISTINCT category FROM catalog_items ORDER BY category ASC').all<{ category: string }>()).results;
  return c.json({
    success: true,
    categories: rows.map((r) => r.category),
  });
});

catalogRoutes.get('/brands', async (c) => {
  const db = getDatabase(c.env?.DB);
  const rows = (await db.prepare('SELECT DISTINCT mapped_brand as brand FROM catalog_items ORDER BY mapped_brand ASC').all<{ brand: string }>()).results;
  return c.json({
    success: true,
    brands: rows.map((r) => r.brand),
  });
});

catalogRoutes.get('/:sku', async (c) => {
  const db = getDatabase(c.env?.DB);
  const sku = c.req.param('sku');
  const result = await catalogService.getCatalogItemBySku(db, sku);

  if (!result.item) {
    return c.json({ success: false, error: `Article with SKU '${sku}' not found.` }, 404);
  }

  return c.json({
    success: true,
    ...result,
  });
});
