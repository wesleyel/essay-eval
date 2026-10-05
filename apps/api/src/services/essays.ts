import type { Backup, EssayDetail } from '@essay/domain';
import type { Database } from '../db/client';
import { findEssay, listEssaySummaries } from '../repositories/essays';
import { listEvaluations, listVersions } from '../repositories/history';
import { findInspiration } from '../repositories/inspirations';
import { listTemplates } from '../repositories/templates';

export async function getEssayDetail(db: Database, id: string): Promise<EssayDetail> {
  const [essay, evaluations, versions, inspiration] = await Promise.all([
    findEssay(db, id),
    listEvaluations(db, id),
    listVersions(db, id),
    findInspiration(db, id),
  ]);
  return { essay, evaluations, versions, inspiration };
}

export async function exportBackup(db: Database): Promise<Backup> {
  const [summaries, templates] = await Promise.all([listEssaySummaries(db, {}), listTemplates(db)]);
  const essays = [];
  // 顺序读取，避免一次性向 D1 发出过多并发查询
  for (const summary of summaries) essays.push(await getEssayDetail(db, summary.id));
  return { exportedAt: new Date().toISOString(), essays, templates };
}
