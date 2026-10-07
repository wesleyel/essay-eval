/**
 * 把旧版 better-sqlite3 数据库（server/data/essay.db）转换为 D1 可执行的 SQL。
 *
 *   pnpm --filter @essay/api db:import-legacy /path/to/essay.db
 *   pnpm --filter @essay/api exec wrangler d1 execute essay-eval --local --file .wrangler/legacy-import.sql
 *
 * 旧库只读打开。旧评分/启发的 JSON 形状与模型输出一致，直接复用 llm/schemas 做清洗与归一。
 * 模型 API Key 不迁移，导入后请在设置页重新填写。
 */
import {
  categoryError,
  defaultCategory,
  normalizeTags,
  ALL_ESSAY_TYPES,
  TEMPLATE_CATEGORIES,
  TYPE_SPECS,
  countWords,
  isSubject,
  subjectOfType,
  type EssayType,
  type Subject,
} from '@essay/domain';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { evaluationOutput, inspirationOutput } from '@essay/ai';

const source = process.argv[2];
if (!source) throw new Error('用法：import-legacy <旧版 essay.db 路径> [输出 SQL 路径]');
const target = resolve(process.argv[3] ?? '.wrangler/legacy-import.sql');
const legacy = new DatabaseSync(source, { readOnly: true });

type Row = Record<string, string | number | null>;
const all = (sql: string) => legacy.prepare(sql).all() as Row[];
const text = (value: unknown) => (typeof value === 'string' ? value : '');
const json = (value: unknown): unknown => {
  try {
    return JSON.parse(text(value));
  } catch {
    return undefined;
  }
};
const hasColumn = (table: string, column: string) => all(`PRAGMA table_info(${table})`).some((row) => row.name === column);

// ---------- SQL 生成 ----------

/** D1 单条 SQL 语句上限约 100KB，长文本需拆分追加 */
const STATEMENT_BUDGET = 90_000;
const sql: string[] = [];
const literal = (value: unknown) => (value === null || value === undefined ? 'NULL' : typeof value === 'number' ? String(value) : `'${String(value).replace(/'/g, "''")}'`);

function insert(table: string, row: Record<string, unknown>, mode: 'IGNORE' | 'REPLACE' = 'IGNORE') {
  const columns = Object.keys(row);
  sql.push(`INSERT OR ${mode} INTO ${table} (${columns.join(', ')}) VALUES (${columns.map((column) => literal(row[column])).join(', ')});`);
}

function appendInChunks(table: string, column: string, id: string, value: string) {
  for (let offset = 0; offset < value.length; offset += STATEMENT_BUDGET) {
    sql.push(`UPDATE ${table} SET ${column} = coalesce(${column}, '') || ${literal(value.slice(offset, offset + STATEMENT_BUDGET))} WHERE id = ${literal(id)};`);
  }
}

// ---------- 作答 ----------

const isEssayType = (value: unknown): value is EssayType => (ALL_ESSAY_TYPES as readonly unknown[]).includes(value);
/** 题型能唯一确定科目；旧数据里科目列可能缺失或错误 */
const essays = new Map<string, { subject: Subject; type: EssayType; title: string }>();
const skipped: string[] = [];

/** 旧数据的分类是自由文本：合法则沿用，否则取题型的默认分类，并把原文本留作主题标签 */
function classify(type: EssayType, legacyCategory: string, legacyTags: unknown) {
  const tags = Array.isArray(legacyTags) ? legacyTags.filter((tag): tag is string => typeof tag === 'string') : [];
  const valid = !categoryError(type, legacyCategory);
  if (!valid && legacyCategory) tags.push(legacyCategory);
  const merged = normalizeTags(tags);
  return { category: valid ? legacyCategory : defaultCategory(type), tags: JSON.stringify(merged.length ? merged : ['待归类']) };
}

for (const row of all('SELECT * FROM essays')) {
  const id = text(row.id);
  const type = row.type;
  if (!isEssayType(type)) {
    skipped.push(`作答 ${id}（未知题型 ${String(type)}）`);
    continue;
  }
  const subject = subjectOfType(type);
  essays.set(id, { subject, type, title: text(row.title) || '未命名' });
  const image = text(row.prompt_image);
  insert('essays', {
    id,
    subject,
    type,
    title: essays.get(id)!.title,
    ...classify(type, text(row.category), json(row.custom_tags)),
    prompt: text(row.prompt),
    prompt_image: null,
    content: text(row.content),
    word_count: countWords(text(row.content), subject),
    created_at: text(row.created_at),
    updated_at: text(row.updated_at),
  });
  if (image) appendInChunks('essays', 'prompt_image', id, image);
}

// ---------- 版本与评分 ----------

const evaluationRows = new Map(all('SELECT * FROM evaluations').map((row) => [text(row.id), row]));
const versionOfEvaluation = new Map<string, string>();

for (const row of all('SELECT * FROM essay_versions')) {
  const essay = essays.get(text(row.essay_id));
  if (!essay) continue;
  const evaluation = row.evaluation_id ? evaluationRows.get(text(row.evaluation_id)) : undefined;
  const type = isEssayType(evaluation?.source_type) ? evaluation.source_type : essay.type;
  if (evaluation && !versionOfEvaluation.has(text(evaluation.id))) versionOfEvaluation.set(text(evaluation.id), text(row.id));
  insert('versions', {
    id: text(row.id),
    essay_id: text(row.essay_id),
    note: text(row.note) || '历史快照',
    title: text(row.title),
    type,
    prompt: text(row.prompt),
    content: text(row.content),
    word_count: countWords(text(row.content), essay.subject),
    created_at: text(row.created_at),
  });
}

for (const [id, row] of evaluationRows) {
  const essay = essays.get(text(row.essay_id));
  if (!essay) continue;
  const type = isEssayType(row.source_type) && subjectOfType(row.source_type) === essay.subject ? row.source_type : essay.type;
  let versionId = versionOfEvaluation.get(id);
  if (!versionId) {
    versionId = `ver-${id}`;
    insert('versions', {
      id: versionId,
      essay_id: text(row.essay_id),
      note: `历史评分快照 (${row.score}分)`,
      title: essay.title,
      type,
      prompt: text(row.source_prompt),
      content: text(row.source_content),
      word_count: countWords(text(row.source_content), essay.subject),
      created_at: text(row.created_at),
    });
  }
  const parsed = evaluationOutput(essay.subject, TYPE_SPECS[type].maxScore).safeParse({
    score: row.score,
    band: row.band,
    dimensions: json(row.dimensions),
    overallComment: row.overall_comment,
    strengths: json(row.strengths),
    weaknesses: json(row.weaknesses),
    corrections: json(row.corrections),
    polishedEssay: text(row.polished_essay) || text(row.source_content) || '（无）',
  });
  if (!parsed.success) {
    skipped.push(`评分 ${id}`);
    continue;
  }
  const report = parsed.data;
  insert('evaluations', {
    id,
    essay_id: text(row.essay_id),
    version_id: versionId,
    score: report.score,
    max_score: report.maxScore,
    band: report.band,
    dimensions: JSON.stringify(report.dimensions),
    overall_comment: report.overallComment,
    strengths: JSON.stringify(report.strengths),
    weaknesses: JSON.stringify(report.weaknesses),
    corrections: JSON.stringify(report.corrections),
    polished: report.polished,
    created_at: text(row.created_at),
  });
}

// ---------- 启发（每篇只保留最新一条） ----------

for (const row of all('SELECT * FROM inspirations ORDER BY created_at ASC')) {
  const essay = essays.get(text(row.essay_id));
  if (!essay) continue;
  const report = inspirationOutput(essay.subject).parse({
    extractedSentences: json(row.extracted_sentences),
    synonymUpgrades: json(row.synonyms_and_upgrades),
    structureSuggestions: json(row.structure_suggestions),
  });
  insert(
    'inspirations',
    {
      essay_id: text(row.essay_id),
      id: text(row.id),
      source_type: isEssayType(row.source_type) && subjectOfType(row.source_type) === essay.subject ? row.source_type : essay.type,
      source_prompt: text(row.source_prompt),
      source_content: text(row.source_content),
      sentences: JSON.stringify(report.sentences),
      upgrades: JSON.stringify(report.upgrades),
      structure_tips: JSON.stringify(report.structureTips),
      created_at: text(row.created_at),
    },
    'REPLACE',
  );
}

// ---------- 语料 ----------

for (const row of all('SELECT * FROM templates')) {
  const subject: Subject = isSubject(row.subject) ? row.subject : 'english';
  const categories: readonly string[] = TEMPLATE_CATEGORIES[subject];
  const sourceId = (json(row.source_essay_ids) as unknown[] | undefined)?.[0];
  insert('templates', {
    id: text(row.id),
    subject,
    category: categories.includes(text(row.category)) ? text(row.category) : '其他',
    pattern: text(row.pattern),
    usage: text(row.description),
    example: text((json(row.examples) as unknown[] | undefined)?.[0]),
    source_essay_id: typeof sourceId === 'string' && essays.has(sourceId) ? sourceId : null,
    created_at: text(row.created_at),
  });
}

// ---------- 模型配置（不含密钥） ----------

const config = hasColumn('settings', 'key') ? (json(all("SELECT value FROM settings WHERE key = 'ai_config'")[0]?.value) as Row | undefined) : undefined;
if (config) {
  insert(
    'ai_config',
    {
      id: 1,
      base_url: text(config.baseUrl) || 'https://api.deepseek.com',
      api_key: '',
      model: text(config.model) || 'deepseek-chat',
      reasoning_effort: ['auto', 'none', 'low', 'medium', 'high'].includes(text(config.reasoningEffort)) ? text(config.reasoningEffort) : 'auto',
    },
    'REPLACE',
  );
}

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${sql.join('\n')}\n`);
console.log(`已生成 ${sql.length} 条语句 → ${target}`);
console.log(`作答 ${essays.size} 篇；评分 ${evaluationRows.size} 条；跳过 ${skipped.length} 条${skipped.length ? `：${skipped.join('、')}` : ''}`);
if (config) console.log('模型配置已迁移，API Key 需在设置页重新填写。');
