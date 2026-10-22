import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { catalogRoutes } from './routes/catalog.routes.js';
import { ingestionRoutes } from './routes/ingestion.routes.js';
import { auditRoutes } from './routes/audit.routes.js';
import { getDatabase } from './db/client.js';
import { runSeeder } from './db/seeder.js';
import { logger } from './utils/logger.js';

export type Bindings = {
  DB?: unknown;
  ENVIRONMENT?: string;
};

export const app = new Hono<{ Bindings: Bindings }>();

// Global Middleware
app.use('*', honoLogger());
app.use('*', cors());

// Health Check Endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'UP',
    service: 'edge-commerce-sync',
    runtime: typeof process !== 'undefined' ? `Node.js ${process.version}` : 'Cloudflare Workers (Edge)',
    timestamp: new Date().toISOString(),
  });
});

// Mount Domain API Routes
app.route('/api/catalog', catalogRoutes);
app.route('/api/ingest', ingestionRoutes);
app.route('/api/audit', auditRoutes);
app.route('/api/stats', auditRoutes); // Supports /api/stats/summary

// Serve Web Dashboard (public/index.html)
app.get('/', (c) => {
  const possiblePaths = [
    resolve(process.cwd(), 'public', 'index.html'),
    resolve(process.cwd(), 'edge-commerce-sync', 'public', 'index.html'),
    resolve(import.meta.dirname ?? '.', '../public/index.html'),
  ];

  for (const htmlPath of possiblePaths) {
    if (existsSync(htmlPath)) {
      const html = readFileSync(htmlPath, 'utf-8');
      return c.html(html);
    }
  }

  return c.html(`
    <!DOCTYPE html>
    <html>
      <head><title>Edge Commerce Sync</title></head>
      <body style="font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem;">
        <h1>⚡ Edge Commerce Sync Hub</h1>
        <p>API is running. Dashboard HTML could not be located.</p>
        <a href="/api/stats/summary" style="color: #38bdf8;">View API Stats</a>
      </body>
    </html>
  `);
});

// Auto-seed database if empty on Node.js startup
async function ensureDatabaseInitialized() {
  try {
    const db = getDatabase();
    const count = await db.prepare('SELECT COUNT(*) as cnt FROM catalog_items').first<{ cnt: number }>();
    if (!count || count.cnt === 0) {
      logger.info('Database empty. Running initial catalog seeder...');
      await runSeeder(db);
      logger.info('Database seeded successfully.');
    }
  } catch (err) {
    logger.warn('Initial database check/seed notice: ' + (err as Error).message);
  }
}

// Node.js Direct Server Startup
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  const isDirectRun = process.argv[1] && (
    process.argv[1].endsWith('index.ts') ||
    process.argv[1].endsWith('index.js')
  );

  if (isDirectRun) {
    ensureDatabaseInitialized().then(async () => {
      const { serve } = await import('@hono/node-server');
      const port = parseInt(process.env.PORT || '8787', 10);
      logger.info(`Starting Edge-First Commerce Sync Hub at http://localhost:${port}`);
      serve({
        fetch: app.fetch,
        port,
      });
      logger.info(`Web UI & Dashboard ready at http://localhost:${port}`);
    });
  }
}

export default app;
