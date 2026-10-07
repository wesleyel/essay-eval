import type { Subject, Template, TemplateDraft } from '@essay/domain';
import { desc, eq, inArray } from 'drizzle-orm';
import type { Database } from '../db/client';
import { toTemplate, type TemplateSourceRow } from '../db/mappers';
import { essays, templates } from '../db/schema';
import { notFound } from '../lib/errors';
import { newId, now } from '../lib/ids';

export async function listTemplates(db: Database, subject?: Subject): Promise<Template[]> {
  const rows = await db
    .select({ template: templates, source: { id: essays.id, title: essays.title, type: essays.type, category: essays.category, tags: essays.tags } })
    .from(templates)
    .leftJoin(essays, eq(essays.id, templates.sourceEssayId))
    .where(subject ? eq(templates.subject, subject) : undefined)
    .orderBy(desc(templates.createdAt));
  return rows.map((row) => toTemplate(row.template, row.source));
}

export interface TemplateCandidate<S extends Subject> extends TemplateDraft<S> {
  source: { essayId: string; title: string };
}

/**
 * 写入一次提取的结果：每篇来源作答只保留最新一次提取，先删掉它之前提取的句式再插入；
 * 与其他作答的句式重复时跳过。返回实际新增的条目。
 */
export async function insertTemplates<S extends Subject>(db: Database, subject: S, candidates: TemplateCandidate<S>[]): Promise<Template[]> {
  if (!candidates.length) return [];
  const createdAt = now();
  const rows = candidates.map(({ source, ...draft }) => ({ ...draft, id: newId('template'), subject, sourceEssayId: source.essayId, createdAt }));
  const essayIds = [...new Set(candidates.map((item) => item.source.essayId))];
  const sources = await findSources(db, essayIds);
  // 逐条插入并忽略重复（D1 单条语句的绑定参数有上限），与清理旧句式放在同一个批次里
  const replace = db.delete(templates).where(inArray(templates.sourceEssayId, essayIds));
  const inserts = rows.map((row) => db.insert(templates).values(row).onConflictDoNothing().returning());
  const [, ...inserted] = await db.batch([replace, ...inserts]);
  return inserted.flat().map((row) => toTemplate(row, row.sourceEssayId ? sources.get(row.sourceEssayId) : null));
}

async function findSources(db: Database, ids: string[]): Promise<Map<string, TemplateSourceRow>> {
  const rows = await db.select({ id: essays.id, title: essays.title, type: essays.type, category: essays.category, tags: essays.tags }).from(essays).where(inArray(essays.id, ids));
  return new Map(rows.map((row) => [row.id, row]));
}

export async function deleteTemplate(db: Database, id: string): Promise<void> {
  const deleted = await db.delete(templates).where(eq(templates.id, id)).returning({ id: templates.id });
  if (!deleted.length) throw notFound('模板');
}

export async function findEssaysForExtraction(db: Database, subject: Subject, essayIds?: string[]) {
  return db.query.essays.findMany({
    columns: { id: true, title: true, type: true, prompt: true, content: true, subject: true },
    where: essayIds ? inArray(essays.id, essayIds) : eq(essays.subject, subject),
    orderBy: desc(essays.updatedAt),
  });
}
