import type { Essay, Inspiration, InspirationReport } from '@essay/domain';
import { eq } from 'drizzle-orm';
import type { Database } from '../db/client';
import { toInspiration } from '../db/mappers';
import { inspirations, type InspirationRow } from '../db/schema';
import { newId, now } from '../lib/ids';

export async function findInspiration(db: Database, essayId: string): Promise<Inspiration | null> {
  const row = await db.query.inspirations.findFirst({ where: eq(inspirations.essayId, essayId) });
  return row ? toInspiration(row) : null;
}

/** 每篇只保留最新一次启发 */
export async function saveInspiration(db: Database, essay: Essay, report: InspirationReport): Promise<Inspiration> {
  const row: InspirationRow = {
    ...report,
    essayId: essay.id,
    id: newId('inspiration'),
    sourceType: essay.type,
    sourcePrompt: essay.prompt,
    sourceContent: essay.content,
    createdAt: now(),
  };
  await db.insert(inspirations).values(row).onConflictDoUpdate({ target: inspirations.essayId, set: row });
  return toInspiration(row);
}
