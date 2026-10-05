import { DEFAULT_AI_CONFIG, type AIConfig, type AISettingsInput } from '@essay/domain';
import { eq } from 'drizzle-orm';
import type { Database } from '../db/client';
import { aiConfig } from '../db/schema';

export async function loadAIConfig(db: Database): Promise<AIConfig> {
  const row = await db.query.aiConfig.findFirst({ where: eq(aiConfig.id, 1) });
  if (!row) return DEFAULT_AI_CONFIG;
  const { id: _id, ...config } = row;
  return config;
}

/** apiKey 省略时沿用已保存的值 */
export async function saveAIConfig(db: Database, input: AISettingsInput): Promise<AIConfig> {
  const { apiKey, ...rest } = input;
  const config: AIConfig = { ...rest, apiKey: apiKey ?? (await loadAIConfig(db)).apiKey };
  await db.insert(aiConfig).values({ id: 1, ...config }).onConflictDoUpdate({ target: aiConfig.id, set: config });
  return config;
}
