/** 行 → 领域对象。只做形状转换，不含业务规则。 */
import { essayKind, type Essay, type Evaluation, type Inspiration, type Template, type Version } from '@essay/domain';
import type { EssayRow, EvaluationRow, InspirationRow, TemplateRow, VersionRow } from './schema';

export function toEssay({ subject, type, ...row }: EssayRow): Essay {
  return { ...row, ...essayKind(subject, type) };
}

export const toSource = (row: Pick<VersionRow, 'type' | 'prompt' | 'content'>) => ({
  type: row.type,
  prompt: row.prompt,
  content: row.content,
});

export function toVersion(row: VersionRow, evaluationId: string | null): Version {
  return {
    id: row.id,
    essayId: row.essayId,
    note: row.note,
    title: row.title,
    source: toSource(row),
    wordCount: row.wordCount,
    evaluationId,
    createdAt: row.createdAt,
  };
}

export function toEvaluation(row: EvaluationRow, version: VersionRow): Evaluation {
  return { ...row, source: toSource(version) };
}

export function toInspiration({ sourceType, sourcePrompt, sourceContent, ...row }: InspirationRow): Inspiration {
  return { ...row, source: { type: sourceType, prompt: sourcePrompt, content: sourceContent } };
}

/** 来源作答的分类信息；作答被删除后为 null */
export type TemplateSourceRow = Pick<EssayRow, 'id' | 'title' | 'type' | 'category' | 'tags'>;

export function toTemplate({ sourceEssayId, ...row }: TemplateRow, source: TemplateSourceRow | null | undefined): Template {
  return {
    ...row,
    source: sourceEssayId && source ? { essayId: source.id, title: source.title, type: source.type, category: source.category, tags: source.tags } : null,
  };
}
