/**
 * 模型输出 → 领域对象的适配层。
 * 模型字段名沿用提示词里的约定（polishedEssay、functionType…），
 * 在这里一次性转换为领域命名，并对枚举越界、分数越界做纠正。
 */
import {
  CORRECTION_KINDS,
  DIMENSION_KEYS,
  SENTENCE_FUNCTIONS,
  SUBSTITUTE_LEVELS,
  TEMPLATE_CATEGORIES,
  UPGRADE_CATEGORIES,
  dimensionMax,
  type DimensionKey,
  type DimensionScore,
  type EvaluationReport,
  type InspirationReport,
  type Subject,
  type TemplateDraft,
} from '@essay/domain';
import { z } from 'zod';

const text = z.string().catch('');
const score = z.coerce.number().refine(Number.isFinite);

/** 逐项校验，丢弃不合格的元素而不是让整个数组失败 */
function keepValid<T>(item: z.ZodType<T>, value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const parsed = item.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

const lenientArray = <T>(item: z.ZodType<T>) => z.unknown().optional().transform((value) => keepValid(item, value));

const strings = lenientArray(z.string().trim().min(1));
const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);

/** 忽略大小写、空白与标点后比较，用于识别"改了等于没改"的条目 */
const comparable = (text: string) => text.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
const changes = (before: string, after: string) => comparable(before) !== comparable(after);

/** 去掉与原文相同或彼此重复的改写 */
function distinctRewrites(original: string, rewrites: string[]): string[] {
  const seen = new Set([comparable(original)]);
  return rewrites.filter((rewrite) => {
    const key = comparable(rewrite);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const dimension = z.object({ score: score.catch(0), feedback: text }).optional().catch(undefined);

export function evaluationOutput<S extends Subject>(subject: S, maxScore: number) {
  const kinds = CORRECTION_KINDS[subject];
  return z
    .object({
      score,
      band: text,
      dimensions: z.object(Object.fromEntries(DIMENSION_KEYS.map((key) => [key, dimension])) as Record<DimensionKey, typeof dimension>).catch({}),
      overallComment: text,
      strengths: strings,
      weaknesses: strings,
      corrections: lenientArray(
        z.object({
          original: z.string().trim().min(1),
          corrected: z.string().trim(),
          type: z.enum(kinds).catch(kinds[0]),
          explanation: text,
        }),
      ),
      polishedEssay: z.string().trim().min(1),
    })
    .transform(
      (raw): EvaluationReport<S> => ({
        score: clamp(raw.score, maxScore),
        maxScore,
        band: raw.band || '已评分',
        dimensions: Object.fromEntries(
          DIMENSION_KEYS.map((key): [DimensionKey, DimensionScore] => {
            const max = dimensionMax(subject, maxScore, key);
            const value = raw.dimensions[key];
            return [key, { score: clamp(value?.score ?? 0, max), maxScore: max, feedback: value?.feedback ?? '' }];
          }),
        ) as Record<DimensionKey, DimensionScore>,
        overallComment: raw.overallComment,
        strengths: raw.strengths,
        weaknesses: raw.weaknesses,
        corrections: raw.corrections
          .filter((item) => changes(item.original, item.corrected))
          .map(({ type, ...item }, index) => ({ id: `c${index + 1}`, kind: type, ...item })),
        polished: raw.polishedEssay,
      }),
    );
}

export function inspirationOutput<S extends Subject>(subject: S) {
  const functions = SENTENCE_FUNCTIONS[subject];
  return z
    .object({
      extractedSentences: lenientArray(
        z.object({
          originalSentence: z.string().trim().min(1),
          functionType: z.enum(functions).catch(functions[0]),
          advancedVariations: strings,
          critique: text,
        }),
      ),
      synonymUpgrades: lenientArray(
        z.object({
          originalWord: z.string().trim().min(1),
          originalContext: text,
          upgradeCategory: z.enum(UPGRADE_CATEGORIES).catch('academic'),
          substitutes: lenientArray(
            z.object({
              word: z.string().trim().min(1),
              level: z.enum(SUBSTITUTE_LEVELS).catch('advanced'),
              nuance: text,
              example: text,
            }),
          ),
        }),
      ),
      structureSuggestions: strings,
    })
    .transform(
      (raw): InspirationReport<S> => ({
        // 没有任何实质改写的条目直接丢弃，不给用户展示空建议
        sentences: raw.extractedSentences.flatMap((item) => {
          const variations = distinctRewrites(item.originalSentence, item.advancedVariations);
          return variations.length ? [{ original: item.originalSentence, function: item.functionType, variations, critique: item.critique }] : [];
        }),
        upgrades: raw.synonymUpgrades.flatMap((item) => {
          const substitutes = item.substitutes.filter((substitute) => changes(item.originalWord, substitute.word));
          return substitutes.length ? [{ word: item.originalWord, context: item.originalContext, category: item.upgradeCategory, substitutes }] : [];
        }),
        structureTips: raw.structureSuggestions,
      }),
    );
}

export function templatesOutput<S extends Subject>(subject: S) {
  const categories = TEMPLATE_CATEGORIES[subject];
  const item = z
    .object({
      template: z.string().trim().min(1),
      category: z.enum(categories).catch('其他' as (typeof categories)[number]),
      usage: text,
      example: text,
    })
    .transform(({ template, ...rest }): TemplateDraft<S> => ({ pattern: template, ...rest }));
  // 模型可能直接返回数组，也可能包一层 { templates: [...] }
  return z
    .unknown()
    .transform((value) => keepValid(item, Array.isArray(value) ? value : Object.values(value ?? {}).find(Array.isArray)));
}

export const titleOutput = z.object({ title: z.string().trim().min(1).max(200) });
