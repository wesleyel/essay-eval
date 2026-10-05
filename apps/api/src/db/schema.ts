import {
  ALL_ESSAY_TYPES,
  ESSAY_TYPES,
  REASONING_EFFORTS,
  SUBJECTS,
  type Correction,
  type DimensionKey,
  type DimensionScore,
  type ExtractedSentence,
  type Subject,
  type TemplateCategory,
  type WordUpgrade,
} from '@essay/domain';
import { sql } from 'drizzle-orm';
import { check, index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const timestamp = (name: string) => text(name).notNull();
const json = <T>(name: string) => text(name, { mode: 'json' }).$type<T>().notNull();
const quoted = (values: readonly string[]) => values.map((value) => `'${value}'`).join(', ');

/** 数据库层面同样保证题型不跨科目 */
const subjectTypeCheck = sql.raw(
  (Object.keys(ESSAY_TYPES) as Subject[])
    .map((subject) => `(subject = '${subject}' AND type IN (${quoted(ESSAY_TYPES[subject])}))`)
    .join(' OR '),
);

export const essays = sqliteTable(
  'essays',
  {
    id: text('id').primaryKey(),
    subject: text('subject', { enum: SUBJECTS }).notNull(),
    type: text('type', { enum: ALL_ESSAY_TYPES }).notNull(),
    title: text('title').notNull(),
    category: text('category').notNull().default(''),
    tags: json<string[]>('tags').default(sql`'[]'`),
    prompt: text('prompt').notNull().default(''),
    promptImage: text('prompt_image'),
    content: text('content').notNull().default(''),
    wordCount: integer('word_count').notNull().default(0),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
  },
  (t) => [check('essays_subject_type', subjectTypeCheck), index('essays_subject_updated').on(t.subject, t.updatedAt)],
);

/** 作答快照。每次评分自动生成一份，也可手动保存。 */
export const versions = sqliteTable(
  'versions',
  {
    id: text('id').primaryKey(),
    essayId: text('essay_id').notNull().references(() => essays.id, { onDelete: 'cascade' }),
    note: text('note').notNull(),
    title: text('title').notNull(),
    type: text('type', { enum: ALL_ESSAY_TYPES }).notNull(),
    prompt: text('prompt').notNull(),
    content: text('content').notNull(),
    wordCount: integer('word_count').notNull(),
    createdAt: timestamp('created_at'),
  },
  (t) => [index('versions_essay_created').on(t.essayId, t.createdAt)],
);

/** 评分与其版本一一对应；作答快照取自所属版本，不再重复存储。 */
export const evaluations = sqliteTable(
  'evaluations',
  {
    id: text('id').primaryKey(),
    essayId: text('essay_id').notNull().references(() => essays.id, { onDelete: 'cascade' }),
    versionId: text('version_id').notNull().references(() => versions.id, { onDelete: 'cascade' }),
    score: real('score').notNull(),
    maxScore: real('max_score').notNull(),
    band: text('band').notNull(),
    dimensions: json<Record<DimensionKey, DimensionScore>>('dimensions'),
    overallComment: text('overall_comment').notNull(),
    strengths: json<string[]>('strengths'),
    weaknesses: json<string[]>('weaknesses'),
    corrections: json<Correction[]>('corrections'),
    polished: text('polished').notNull(),
    createdAt: timestamp('created_at'),
  },
  (t) => [uniqueIndex('evaluations_version').on(t.versionId), index('evaluations_essay_created').on(t.essayId, t.createdAt)],
);

/** 每篇只保留最新一次启发 */
export const inspirations = sqliteTable('inspirations', {
  essayId: text('essay_id').primaryKey().references(() => essays.id, { onDelete: 'cascade' }),
  id: text('id').notNull(),
  sourceType: text('source_type', { enum: ALL_ESSAY_TYPES }).notNull(),
  sourcePrompt: text('source_prompt').notNull(),
  sourceContent: text('source_content').notNull(),
  sentences: json<ExtractedSentence[]>('sentences'),
  upgrades: json<WordUpgrade[]>('upgrades'),
  structureTips: json<string[]>('structure_tips'),
  createdAt: timestamp('created_at'),
});

export const templates = sqliteTable(
  'templates',
  {
    id: text('id').primaryKey(),
    subject: text('subject', { enum: SUBJECTS }).notNull(),
    category: text('category').$type<TemplateCategory>().notNull(),
    pattern: text('pattern').notNull(),
    usage: text('usage').notNull(),
    example: text('example').notNull(),
    sourceEssayId: text('source_essay_id').references(() => essays.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at'),
  },
  (t) => [uniqueIndex('templates_subject_pattern').on(t.subject, t.pattern), index('templates_subject_created').on(t.subject, t.createdAt)],
);

/** 单行表：模型接入配置 */
export const aiConfig = sqliteTable(
  'ai_config',
  {
    id: integer('id').primaryKey(),
    baseUrl: text('base_url').notNull(),
    apiKey: text('api_key').notNull(),
    model: text('model').notNull(),
    reasoningEffort: text('reasoning_effort', { enum: REASONING_EFFORTS }).notNull(),
  },
  (t) => [check('ai_config_singleton', sql`${t.id} = 1`)],
);

export type EssayRow = typeof essays.$inferSelect;
export type VersionRow = typeof versions.$inferSelect;
export type EvaluationRow = typeof evaluations.$inferSelect;
export type InspirationRow = typeof inspirations.$inferSelect;
export type TemplateRow = typeof templates.$inferSelect;
