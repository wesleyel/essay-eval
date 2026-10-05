import { createEssayInput, createVersionInput, essayListQuery, updateEssayInput } from '@essay/domain';
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { validate } from '../lib/validate';
import { createEssay, deleteEssay, findEssay, listEssaySummaries, updateEssay } from '../repositories/essays';
import { createSnapshot, deleteEvaluation, deleteVersion } from '../repositories/history';
import { getEssayDetail } from '../services/essays';

export const essayRoutes = new Hono<AppEnv>()
  .get('/', validate('query', essayListQuery), async (c) => c.json(await listEssaySummaries(c.var.db, c.req.valid('query'))))
  .post('/', validate('json', createEssayInput), async (c) => c.json(await createEssay(c.var.db, c.req.valid('json')), 201))
  .get('/:id', async (c) => c.json(await getEssayDetail(c.var.db, c.req.param('id'))))
  .patch('/:id', validate('json', updateEssayInput), async (c) => c.json(await updateEssay(c.var.db, c.req.param('id'), c.req.valid('json'))))
  .delete('/:id', async (c) => {
    await deleteEssay(c.var.db, c.req.param('id'));
    return c.body(null, 204);
  })

  // 版本快照
  .post('/:id/versions', validate('json', createVersionInput), async (c) => {
    const essay = await findEssay(c.var.db, c.req.param('id'));
    return c.json(await createSnapshot(c.var.db, essay, c.req.valid('json').note), 201);
  })
  .delete('/:id/versions/:versionId', async (c) => {
    await deleteVersion(c.var.db, c.req.param('id'), c.req.param('versionId'));
    return c.body(null, 204);
  })

  // AI：评分、启发、标题
  .post('/:id/evaluations', async (c) => c.json(await c.var.review.evaluate(c.req.param('id')), 201))
  .delete('/:id/evaluations/:evaluationId', async (c) => {
    await deleteEvaluation(c.var.db, c.req.param('id'), c.req.param('evaluationId'));
    return c.body(null, 204);
  })
  .post('/:id/inspiration', async (c) => c.json(await c.var.review.inspire(c.req.param('id'))))
  .post('/:id/title', async (c) => c.json({ title: await c.var.review.suggestTitle(c.req.param('id')) }));
