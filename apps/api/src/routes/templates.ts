import { extractTemplatesInput, templateListQuery } from '@essay/domain';
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { validate } from '../lib/validate';
import { deleteTemplate, listTemplates } from '../repositories/templates';

export const templateRoutes = new Hono<AppEnv>()
  .get('/', validate('query', templateListQuery), async (c) => c.json(await listTemplates(c.var.db, c.req.valid('query').subject)))
  .post('/extract', validate('json', extractTemplatesInput), async (c) => c.json(await c.var.review.extractTemplates(c.req.valid('json')), 201))
  .delete('/:id', async (c) => {
    await deleteTemplate(c.var.db, c.req.param('id'));
    return c.body(null, 204);
  });
