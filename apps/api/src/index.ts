import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { createDb } from './db/client';
import type { AppEnv } from './env';
import { AppError } from './lib/errors';
import { essayRoutes } from './routes/essays';
import { settingsRoutes } from './routes/settings';
import { templateRoutes } from './routes/templates';
import { exportBackup } from './services/essays';
import { ReviewService } from './services/review';

const api = new Hono<AppEnv>()
  .use(async (c, next) => {
    const db = createDb(c.env.DB);
    c.set('db', db);
    c.set('review', new ReviewService(db, c.env));
    await next();
  })
  .route('/essays', essayRoutes)
  .route('/templates', templateRoutes)
  .route('/settings', settingsRoutes)
  .get('/backup', async (c) => c.json(await exportBackup(c.var.db)));

const app = new Hono<AppEnv>()
  .use('/api/*', logger())
  .route('/api', api)
  .notFound((c) => (c.req.path.startsWith('/api/') ? c.json({ error: '接口不存在' }, 404) : c.env.ASSETS.fetch(c.req.raw)))
  .onError((error, c) => {
    if (error instanceof AppError) return c.json({ error: error.message }, error.status);
    console.error(error);
    return c.json({ error: '服务器内部错误' }, 500);
  });

export default app;
