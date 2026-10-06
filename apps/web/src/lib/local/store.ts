/** 浏览器端的仓库层，行为对齐 Worker 的 repositories：同样的领域对象，存进 IndexedDB */
import {
  DEFAULT_AI_CONFIG,
  DEFAULT_TYPE,
  LENGTH_UNIT,
  countWords,
  isTypeOf,
  type AIConfig,
  type Backup,
  type CreateEssayInput,
  type Essay,
  type EssayDetail,
  type EssayListQuery,
  type EssaySummary,
  type Evaluation,
  type EvaluationReport,
  type Inspiration,
  type InspirationReport,
  type Subject,
  type Template,
  type TemplateDraft,
  type UpdateEssayInput,
  type Version,
} from '@essay/domain';
import { badRequest, notFound } from '@essay/ai';
import { STORES, transaction, type Tx } from './idb';

const UNTITLED = { english: '未命名作文', politics: '未命名政治作答' } as const;
const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const now = () => new Date().toISOString();
const byNewest = <T extends { createdAt: string }>(a: T, b: T) => b.createdAt.localeCompare(a.createdAt);

/** 版本行：版本自带作答快照 */
type VersionRow = Omit<Version, 'source' | 'evaluationId'> & Version['source'];
type EvaluationRow = Omit<Evaluation, 'source'>;
type InspirationRow = Omit<Inspiration, 'source'> & { sourceType: Essay['type']; sourcePrompt: string; sourceContent: string };
type TemplateRow = Omit<Template, 'source'> & { sourceEssayId: string | null };

const toVersion = ({ type, prompt, content, ...row }: VersionRow, evaluationId: string | null): Version => ({
  ...row,
  source: { type, prompt, content },
  evaluationId,
});
const versionRow = (essay: Essay, note: string, createdAt: string): VersionRow => ({
  id: newId('ver'),
  essayId: essay.id,
  note,
  title: essay.title,
  type: essay.type,
  prompt: essay.prompt,
  content: essay.content,
  wordCount: essay.wordCount,
  createdAt,
});

const essayOf = async (tx: Tx, id: string) => {
  const essay = await tx.get<Essay>(STORES.essays, id);
  if (!essay) throw notFound('作答');
  return essay;
};

async function historyOf(tx: Tx, essayId: string) {
  const [versionRows, evaluationRows, inspirationRow] = await Promise.all([
    tx.byIndex<VersionRow>(STORES.versions, 'essayId', essayId),
    tx.byIndex<EvaluationRow>(STORES.evaluations, 'essayId', essayId),
    tx.get<InspirationRow>(STORES.inspirations, essayId),
  ]);
  const versionById = new Map(versionRows.map((row) => [row.id, row]));
  const evaluationByVersion = new Map(evaluationRows.map((row) => [row.versionId, row.id]));
  const evaluations = evaluationRows.sort(byNewest).flatMap((row): Evaluation[] => {
    const version = versionById.get(row.versionId);
    return version ? [{ ...row, source: { type: version.type, prompt: version.prompt, content: version.content } }] : [];
  });
  const versions = versionRows.sort(byNewest).map((row) => toVersion(row, evaluationByVersion.get(row.id) ?? null));
  const inspiration: Inspiration | null = inspirationRow
    ? (({ sourceType, sourcePrompt, sourceContent, ...row }: InspirationRow): Inspiration => ({
        ...row,
        source: { type: sourceType, prompt: sourcePrompt, content: sourceContent },
      }))(inspirationRow)
    : null;
  return { evaluations, versions, inspiration };
}

// ---------- 作答 ----------

export const listEssays = (query: EssayListQuery): Promise<EssaySummary[]> =>
  transaction([STORES.essays, STORES.versions, STORES.evaluations], 'readonly', async (tx) => {
    const [essays, versions, evaluations] = await Promise.all([
      tx.all<Essay>(STORES.essays),
      tx.all<VersionRow>(STORES.versions),
      tx.all<EvaluationRow>(STORES.evaluations),
    ]);
    const evaluationsByEssay = Map.groupBy(evaluations.sort(byNewest), (row) => row.essayId);
    const versionTotals = Map.groupBy(versions, (row) => row.essayId);
    return essays
      .filter((essay) => (!query.subject || essay.subject === query.subject) && (!query.type || essay.type === query.type))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(({ promptImage, ...essay }): EssaySummary => {
        const history = evaluationsByEssay.get(essay.id) ?? [];
        const latest = history[0];
        return {
          ...essay,
          hasPromptImage: promptImage !== null,
          latestEvaluation: latest ? { id: latest.id, score: latest.score, maxScore: latest.maxScore, band: latest.band, createdAt: latest.createdAt } : null,
          evaluationCount: history.length,
          versionCount: versionTotals.get(essay.id)?.length ?? 0,
        };
      });
  });

const detailOf = async (tx: Tx, id: string): Promise<EssayDetail> => ({ essay: await essayOf(tx, id), ...(await historyOf(tx, id)) });

export const getEssay = (id: string) => transaction([STORES.essays, STORES.versions, STORES.evaluations, STORES.inspirations], 'readonly', (tx) => detailOf(tx, id));

export const findEssay = (id: string) => transaction([STORES.essays], 'readonly', (tx) => essayOf(tx, id));

export const createEssay = (input: CreateEssayInput): Promise<Essay> =>
  transaction([STORES.essays], 'readwrite', async (tx) => {
    const timestamp = now();
    const content = input.content ?? '';
    const essay = {
      id: newId('essay'),
      subject: input.subject,
      type: input.type ?? DEFAULT_TYPE[input.subject],
      title: input.title || UNTITLED[input.subject],
      category: input.category ?? '',
      tags: input.tags ?? [],
      prompt: input.prompt ?? '',
      promptImage: input.promptImage ?? null,
      content,
      wordCount: countWords(content, input.subject),
      createdAt: timestamp,
      updatedAt: timestamp,
    } as Essay;
    await tx.put(STORES.essays, essay);
    return essay;
  });

export const updateEssay = (id: string, patch: UpdateEssayInput): Promise<Essay> =>
  transaction([STORES.essays], 'readwrite', async (tx) => {
    const current = await essayOf(tx, id);
    if (patch.type && !isTypeOf(current.subject, patch.type)) throw badRequest('题型不属于当前板块，请在对应板块新建');
    const next = {
      ...current,
      ...patch,
      ...(patch.content !== undefined && { wordCount: countWords(patch.content, current.subject) }),
      updatedAt: now(),
    } as Essay;
    await tx.put(STORES.essays, next);
    return next;
  });

export const deleteEssay = (id: string): Promise<void> =>
  transaction([STORES.essays, STORES.versions, STORES.evaluations, STORES.inspirations, STORES.templates], 'readwrite', async (tx) => {
    await essayOf(tx, id);
    const [versions, evaluations, templates] = await Promise.all([
      tx.byIndex<VersionRow>(STORES.versions, 'essayId', id),
      tx.byIndex<EvaluationRow>(STORES.evaluations, 'essayId', id),
      tx.all<TemplateRow>(STORES.templates),
    ]);
    await Promise.all([
      ...versions.map((row) => tx.delete(STORES.versions, row.id)),
      ...evaluations.map((row) => tx.delete(STORES.evaluations, row.id)),
      tx.delete(STORES.inspirations, id),
      // 句式保留，来源置空
      ...templates.filter((row) => row.sourceEssayId === id).map((row) => tx.put(STORES.templates, { ...row, sourceEssayId: null })),
    ]);
    await tx.delete(STORES.essays, id);
  });

// ---------- 版本与评分 ----------

export const createSnapshot = (essayId: string, note?: string): Promise<Version> =>
  transaction([STORES.essays, STORES.versions], 'readwrite', async (tx) => {
    const essay = await essayOf(tx, essayId);
    const row = versionRow(essay, note || `作答草稿快照 (${essay.wordCount} ${LENGTH_UNIT[essay.subject]})`, now());
    await tx.put(STORES.versions, row);
    return toVersion(row, null);
  });

export const deleteVersion = (essayId: string, versionId: string): Promise<void> =>
  transaction([STORES.versions, STORES.evaluations], 'readwrite', async (tx) => {
    const version = await tx.get<VersionRow>(STORES.versions, versionId);
    if (!version || version.essayId !== essayId) throw notFound('版本');
    const evaluations = await tx.byIndex<EvaluationRow>(STORES.evaluations, 'essayId', essayId);
    await Promise.all(evaluations.filter((row) => row.versionId === versionId).map((row) => tx.delete(STORES.evaluations, row.id)));
    await tx.delete(STORES.versions, versionId);
  });

/** 只删评分，保留其版本作为普通草稿快照 */
export const deleteEvaluation = (essayId: string, evaluationId: string): Promise<void> =>
  transaction([STORES.evaluations], 'readwrite', async (tx) => {
    const row = await tx.get<EvaluationRow>(STORES.evaluations, evaluationId);
    if (!row || row.essayId !== essayId) throw notFound('评分记录');
    await tx.delete(STORES.evaluations, evaluationId);
  });

export const saveEvaluation = (essayId: string, report: EvaluationReport): Promise<{ evaluation: Evaluation; version: Version }> =>
  transaction([STORES.essays, STORES.versions, STORES.evaluations], 'readwrite', async (tx) => {
    const essay = await essayOf(tx, essayId);
    const createdAt = now();
    const total = (await tx.byIndex<EvaluationRow>(STORES.evaluations, 'essayId', essayId)).length;
    const version = versionRow(essay, `第 ${total + 1} 次批改快照 (${report.score}分)`, createdAt);
    const row: EvaluationRow = { ...report, id: newId('eval'), essayId, versionId: version.id, createdAt };
    await tx.put(STORES.versions, version);
    await tx.put(STORES.evaluations, row);
    return {
      evaluation: { ...row, source: { type: version.type, prompt: version.prompt, content: version.content } },
      version: toVersion(version, row.id),
    };
  });

/** 每篇只保留最新一次启发 */
export const saveInspiration = (essayId: string, report: InspirationReport): Promise<Inspiration> =>
  transaction([STORES.essays, STORES.inspirations], 'readwrite', async (tx) => {
    const essay = await essayOf(tx, essayId);
    const row: InspirationRow = { ...report, essayId, id: newId('insp'), sourceType: essay.type, sourcePrompt: essay.prompt, sourceContent: essay.content, createdAt: now() };
    await tx.put(STORES.inspirations, row);
    return { ...report, id: row.id, essayId, source: { type: essay.type, prompt: essay.prompt, content: essay.content }, createdAt: row.createdAt };
  });

// ---------- 句式库 ----------

const listTemplatesIn = async (tx: Tx, subject?: Subject): Promise<Template[]> => {
  const [rows, essays] = await Promise.all([tx.all<TemplateRow>(STORES.templates), tx.all<Essay>(STORES.essays)]);
  const titles = new Map(essays.map((essay) => [essay.id, essay.title]));
  return rows
    .filter((row) => !subject || row.subject === subject)
    .sort(byNewest)
    .map(({ sourceEssayId, ...row }) => ({
      ...row,
      source: sourceEssayId && titles.has(sourceEssayId) ? { essayId: sourceEssayId, title: titles.get(sourceEssayId)! } : null,
    }));
};

export const listTemplates = (subject?: Subject) => transaction([STORES.templates, STORES.essays], 'readonly', (tx) => listTemplatesIn(tx, subject));

export const listExtractionSources = (subject: Subject, essayId?: string) =>
  transaction([STORES.essays], 'readonly', async (tx) => {
    const essays = essayId ? [await essayOf(tx, essayId)] : (await tx.all<Essay>(STORES.essays)).filter((essay) => essay.subject === subject).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return essays;
  });

/** 插入新句式；同科目下已存在的句式被跳过。返回实际新增的条目。 */
export const insertTemplates = (subject: Subject, drafts: (TemplateDraft & { source: { essayId: string; title: string } })[]): Promise<Template[]> =>
  transaction([STORES.templates], 'readwrite', async (tx) => {
    const known = new Set((await tx.all<TemplateRow>(STORES.templates)).filter((row) => row.subject === subject).map((row) => row.pattern));
    const createdAt = now();
    const inserted: Template[] = [];
    for (const { source, ...draft } of drafts) {
      if (known.has(draft.pattern)) continue;
      known.add(draft.pattern);
      const row: TemplateRow = { ...draft, id: newId('tpl'), subject, sourceEssayId: source.essayId, createdAt };
      await tx.put(STORES.templates, row);
      const { sourceEssayId: _omit, ...rest } = row;
      inserted.push({ ...rest, source });
    }
    return inserted;
  });

export const deleteTemplate = (id: string): Promise<void> =>
  transaction([STORES.templates], 'readwrite', async (tx) => {
    if (!(await tx.get(STORES.templates, id))) throw notFound('模板');
    await tx.delete(STORES.templates, id);
  });

// ---------- 设置与备份 ----------

export const loadAIConfig = (): Promise<AIConfig> =>
  transaction([STORES.settings], 'readonly', async (tx) => {
    const row = await tx.get<{ key: string; value: AIConfig }>(STORES.settings, 'ai');
    return row?.value ?? DEFAULT_AI_CONFIG;
  });

export const saveAIConfig = (config: AIConfig): Promise<AIConfig> =>
  transaction([STORES.settings], 'readwrite', async (tx) => {
    await tx.put(STORES.settings, { key: 'ai', value: config });
    return config;
  });

export const exportBackup = (): Promise<Backup> =>
  transaction([STORES.essays, STORES.versions, STORES.evaluations, STORES.inspirations, STORES.templates], 'readonly', async (tx) => {
    const essays = (await tx.all<Essay>(STORES.essays)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const details: EssayDetail[] = [];
    for (const essay of essays) details.push(await detailOf(tx, essay.id));
    return { exportedAt: now(), essays: details, templates: await listTemplatesIn(tx) };
  });
