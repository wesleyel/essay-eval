import {
  countWords,
  isTypeOf,
  normalizeTags,
  patchCategoryError,
  type CreateEssayInput,
  type Essay,
  type EssayListQuery,
  type EssaySummary,
  type EvaluationSummary,
  type UpdateEssayInput,
} from '@essay/domain';
import { and, count, desc, eq, getTableColumns, inArray, isNotNull, type SQL } from 'drizzle-orm';
import type { Database } from '../db/client';
import { toEssay } from '../db/mappers';
import { essays, evaluations, versions } from '../db/schema';
import { badRequest, notFound } from '../lib/errors';
import { newId, now } from '../lib/ids';

const UNTITLED = { english: '未命名作文', politics: '未命名政治作答' } as const;

export async function findEssay(db: Database, id: string): Promise<Essay> {
  const row = await db.query.essays.findFirst({ where: eq(essays.id, id) });
  if (!row) throw notFound('作答');
  return toEssay(row);
}

export async function listEssaySummaries(db: Database, query: EssayListQuery): Promise<EssaySummary[]> {
  const filters: SQL[] = [];
  if (query.subject) filters.push(eq(essays.subject, query.subject));
  if (query.type) filters.push(eq(essays.type, query.type));
  const { promptImage, ...listColumns } = getTableColumns(essays);

  const rows = await db
    .select({ ...listColumns, hasPromptImage: isNotNull(promptImage) })
    .from(essays)
    .where(and(...filters))
    .orderBy(desc(essays.updatedAt));
  if (!rows.length) return [];

  const ids = rows.map((row) => row.id);
  const [scores, versionCounts] = await db.batch([
    db
      .select({ essayId: evaluations.essayId, id: evaluations.id, score: evaluations.score, maxScore: evaluations.maxScore, band: evaluations.band, createdAt: evaluations.createdAt })
      .from(evaluations)
      .where(inArray(evaluations.essayId, ids))
      .orderBy(desc(evaluations.createdAt)),
    db.select({ essayId: versions.essayId, total: count() }).from(versions).where(inArray(versions.essayId, ids)).groupBy(versions.essayId),
  ]);

  const evaluationsByEssay = Map.groupBy(scores, (row) => row.essayId);
  const versionTotals = new Map(versionCounts.map((row) => [row.essayId, row.total]));

  return rows.map(({ hasPromptImage, ...row }) => {
    const history = evaluationsByEssay.get(row.id) ?? [];
    const latest = history[0];
    const { promptImage: _image, ...essay } = toEssay({ ...row, promptImage: null });
    return {
      ...essay,
      hasPromptImage: Boolean(hasPromptImage),
      latestEvaluation: latest ? ({ id: latest.id, score: latest.score, maxScore: latest.maxScore, band: latest.band, createdAt: latest.createdAt } satisfies EvaluationSummary) : null,
      evaluationCount: history.length,
      versionCount: versionTotals.get(row.id) ?? 0,
    } satisfies EssaySummary;
  });
}

export async function createEssay(db: Database, input: CreateEssayInput): Promise<Essay> {
  const timestamp = now();
  const content = input.content ?? '';
  const [row] = await db
    .insert(essays)
    .values({
      id: newId('essay'),
      subject: input.subject,
      type: input.type,
      title: input.title || UNTITLED[input.subject],
      category: input.category ?? '',
      tags: normalizeTags(input.tags),
      prompt: input.prompt ?? '',
      promptImage: input.promptImage ?? null,
      content,
      wordCount: countWords(content, input.subject),
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .returning();
  return toEssay(row!);
}

export async function updateEssay(db: Database, id: string, patch: UpdateEssayInput): Promise<Essay> {
  const current = await findEssay(db, id);
  if (patch.type && !isTypeOf(current.subject, patch.type)) {
    throw badRequest('题型不属于当前板块，请在对应板块新建');
  }
  const classification = patchCategoryError(current, patch);
  if (classification) throw badRequest(classification);
  const [row] = await db
    .update(essays)
    .set({
      ...patch,
      ...(patch.tags && { tags: normalizeTags(patch.tags) }),
      ...(patch.content !== undefined && { wordCount: countWords(patch.content, current.subject) }),
      updatedAt: now(),
    })
    .where(eq(essays.id, id))
    .returning();
  return toEssay(row!);
}

export async function deleteEssay(db: Database, id: string): Promise<void> {
  const deleted = await db.delete(essays).where(eq(essays.id, id)).returning({ id: essays.id });
  if (!deleted.length) throw notFound('作答');
}
