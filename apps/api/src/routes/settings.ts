import { aiSettingsInput, type AIConfig, type AISettingsView, type ConnectionTestResult } from '@essay/domain';
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { AppError } from '../lib/errors';
import { validate } from '../lib/validate';
import { loadAIConfig, saveAIConfig } from '../repositories/settings';

const toView = ({ apiKey, ...config }: AIConfig, fallbackKey?: string): AISettingsView => ({ ...config, apiKeySet: Boolean(apiKey || fallbackKey) });

export const settingsRoutes = new Hono<AppEnv>()
  .get('/', async (c) => c.json(toView(await loadAIConfig(c.var.db), c.env.AI_API_KEY)))
  .put('/', validate('json', aiSettingsInput), async (c) => c.json(toView(await saveAIConfig(c.var.db, c.req.valid('json')), c.env.AI_API_KEY)))
  /** 用表单里尚未保存的配置测试连通性；未填密钥时使用已保存的密钥 */
  .post('/test', validate('json', aiSettingsInput), async (c) => {
    const { apiKey, ...rest } = c.req.valid('json');
    try {
      const reply = await c.var.review.testConnection({ ...rest, ...(apiKey && { apiKey }) });
      return c.json({ ok: true, message: `连通成功！模型回复：${reply}` } satisfies ConnectionTestResult);
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      return c.json({ ok: false, message: `测试连通失败：${error.message}` } satisfies ConnectionTestResult);
    }
  });
