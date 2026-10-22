import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../../src/index.js';
import { resetLocalDatabase } from '../../src/db/client.js';
import { runSeeder } from '../../src/db/seeder.js';

describe('API Integration Tests', () => {
  beforeAll(async () => {
    const memDb = resetLocalDatabase(true);
    await runSeeder(memDb);
  });

  it('GET /health - should return UP status and runtime info', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('UP');
    expect(body.runtime).toBeDefined();
  });

  it('GET /api/catalog - should return seeded items with pagination', async () => {
    const res = await app.request('/api/catalog?limit=5');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.items.length).toBe(5);
    expect(body.total).toBeGreaterThanOrEqual(50);
  });

  it('GET /api/catalog/:sku - should return specific item with mapped brand', async () => {
    const res = await app.request('/api/catalog/NFZ-BR-1002');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.item.sku).toBe('NFZ-BR-1002');
    expect(body.item.mappedBrand).toBe('ApexTruck Pro');
    expect(body.item.sellingPrice).toBeGreaterThan(body.item.purchasePrice);
  });

  it('GET /api/stats/summary - should return aggregated KPIs', async () => {
    const res = await app.request('/api/stats/summary');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.stats.totalSkus).toBeGreaterThan(0);
    expect(body.stats.totalSellingValue).toBeGreaterThan(0);
    expect(body.stats.avgMarginPct).toBeGreaterThan(0);
  });

  it('POST /api/ingest/csv - should process uploaded CSV items', async () => {
    const csvData = `SKU;EAN;Title;Brand;Category;PurchasePrice;Stock;SupplierName
CUSTOM-99;4012345000018;Test-EBS-Ventil;GENERIC_HD;Druckluft;65.00;10;TestLieferant`;

    const res = await app.request('/api/ingest/csv', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/csv',
      },
      body: csvData,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.summary.processed).toBe(1);
    expect(body.summary.inserted).toBe(1);

    // Verify item was created with mapped brand
    const checkRes = await app.request('/api/catalog/CUSTOM-99');
    const checkBody = await checkRes.json();
    expect(checkBody.item.mappedBrand).toBe('OmniCraft Fleet');
  });

  it('POST /api/ingest/simulate - should execute 50-item simulation feed', async () => {
    const res = await app.request('/api/ingest/simulate', {
      method: 'POST',
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.summary.processed).toBeGreaterThanOrEqual(50);
  });
});
