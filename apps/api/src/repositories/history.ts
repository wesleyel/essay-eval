/** 版本快照与评分记录。评分总是挂在一个版本上，版本删除时评分随之删除。 */
import { LENGTH_UNIT, type Essay, type Evaluation, type EvaluationReport, type Version } from '@essay/domain';
import { and, desc, eq } from 'drizzle-orm';
import type { Database } from '../db/client';
import { toEvaluation, toVersion } from '../db/mappers';
import { evaluations, versions, type VersionRow } from '../db/schema';
import { notFound } from '../lib/errors';
import { newId, now } from '../lib/ids';

function versionRow(essay: Essay, note: string, createdAt: string): VersionRow {
  return {
    id: newId('version'),
    essayId: essay.id,
    note,
    title: essay.title,
    type: essay.type,
    prompt: essay.prompt,
    content: essay.content,
    wordCount: essay.wordCount,
    createdAt,
  };
}

export async function listVersions(db: Database, essayId: string): Promise<Version[]> {
  const rows = await db
    .select({ version: versions, evaluationId: evaluations.id })
    .from(versions)
    .leftJoin(evaluations, eq(evaluations.versionId, versions.id))
    .where(eq(versions.essayId, essayId))
    .orderBy(desc(versions.createdAt));
  return rows.map((row) => toVersion(row.version, row.evaluationId));
}

export async function listEvaluations(db: Database, essayId: string): Promise<Evaluation[]> {
  const rows = await db
    .select({ evaluation: evaluations, version: versions })
    .from(evaluations)
    .innerJoin(versions, eq(versions.id, evaluations.versionId))
    .where(eq(evaluations.essayId, essayId))
    .orderBy(desc(evaluations.createdAt));
  return rows.map((row) => toEvaluation(row.evaluation, row.version));
}

/** 手动保存当前作答为快照 */
export async function createSnapshot(db: Database, essay: Essay, note?: string): Promise<Version> {
  const row = versionRow(essay, note || `作答草稿快照 (${essay.wordCount} ${LENGTH_UNIT[essay.subject]})`, now());
  await db.insert(versions).values(row);
  return toVersion(row, null);
}

/** 保存一次评分，并把被评的作答沉淀为版本；两条写入在同一个批次里原子完成 */
export async function saveEvaluation(db: Database, essay: Essay, report: EvaluationReport): Promise<{ evaluation: Evaluation; version: Version }> {
  const createdAt = now();
  const total = await db.$count(evaluations, eq(evaluations.essayId, essay.id));
  const version = versionRow(essay, `第 ${total + 1} 次批改快照 (${report.score}分)`, createdAt);
  const evaluation = { ...report, id: newId('evaluation'), essayId: essay.id, versionId: version.id, createdAt };
  await db.batch([db.insert(versions).values(version), db.insert(evaluations).values(evaluation)]);
  return { evaluation: toEvaluation(evaluation, version), version: toVersion(version, evaluation.id) };
}

export async function deleteVersion(db: Database, essayId: string, versionId: string): Promise<void> {
  const deleted = await db
    .delete(versions)
    .where(and(eq(versions.id, versionId), eq(versions.essayId, essayId)))
    .returning({ id: versions.id });
  if (!deleted.length) throw notFound('版本');
}

/** 只删评分，保留其版本作为普通草稿快照 */
export async function deleteEvaluation(db: Database, essayId: string, evaluationId: string): Promise<void> {
  const deleted = await db
    .delete(evaluations)
    .where(and(eq(evaluations.id, evaluationId), eq(evaluations.essayId, essayId)))
    .returning({ id: evaluations.id });
  if (!deleted.length) throw notFound('评分记录');
}
