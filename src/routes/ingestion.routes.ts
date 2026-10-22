import { Hono } from 'hono';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ParserService } from '../services/parser.service.js';
import { CatalogService } from '../services/catalog.service.js';
import { getDatabase } from '../db/client.js';

type Bindings = {
  DB?: unknown;
};

export const ingestionRoutes = new Hono<{ Bindings: Bindings }>();
const parserService = new ParserService();
const catalogService = new CatalogService();

ingestionRoutes.post('/csv', async (c) => {
  const db = getDatabase(c.env?.DB);
  let csvContent = '';

  const contentType = c.req.header('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const body = await c.req.parseBody();
    const file = body['file'];
    if (file instanceof File) {
      csvContent = await file.text();
    } else if (typeof file === 'string') {
      csvContent = file;
    }
  } else {
    csvContent = await c.req.text();
  }

  if (!csvContent || !csvContent.trim()) {
    return c.json({ success: false, error: 'Empty CSV payload provided.' }, 400);
  }

  const items = parserService.parseCsv(csvContent);
  if (items.length === 0) {
    return c.json({ success: false, error: 'Could not parse any valid items from CSV.' }, 400);
  }

  const summary = await catalogService.processBatch(items, db, 'CSV_UPLOAD');
  return c.json({
    success: true,
    summary,
  });
});

ingestionRoutes.post('/simulate', async (c) => {
  const db = getDatabase(c.env?.DB);

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
    return c.json({ success: false, error: 'Demo supplier feed CSV file not found on server.' }, 500);
  }

  const items = parserService.parseCsv(csvContent);

  // Optional: Add small random price variance to 3 items to show live price audit triggers
  const variedItems = items.map((item, idx) => {
    if (idx === 0) {
      // Fluctuate Bremsscheibe price
      const delta = (Math.random() > 0.5 ? 1 : -1) * (15 + Math.floor(Math.random() * 10));
      const newPrice = Math.max(10, Math.round(((item.purchasePrice as number) * (1 + delta / 100)) * 100) / 100);
      return { ...item, purchasePrice: newPrice };
    }
    if (idx === 5) {
      // Fluctuate NOx sensor price
      const delta = 18.5;
      const newPrice = Math.round(((item.purchasePrice as number) * (1 + delta / 100)) * 100) / 100;
      return { ...item, purchasePrice: newPrice };
    }
    return item;
  });

  const summary = await catalogService.processBatch(variedItems, db, 'LIVE_SIMULATION');

  return c.json({
    success: true,
    message: `Processed ${summary.processed} commercial vehicle catalog items.`,
    summary,
  });
});
