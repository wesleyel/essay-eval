/**
 * 评分、启发、标题、语料提取。
 * 每个操作都写成以科目为类型参数的泛型函数（correlated union 模式），
 * 由 PROMPTS[subject] 与对应的输出 schema 决定行为，科目之间零重复。
 */
import {
  TYPE_SPECS,
  type AIConfig,
  type Essay,
  type EssayOf,
  type Evaluation,
  type ExtractTemplatesInput,
  type Inspiration,
  type Subject,
  type Template,
  type Version,
} from '@essay/domain';
import type { Database } from '../db/client';
import type { Env } from '../env';
import { badRequest } from '../lib/errors';
import { chat, chatJson } from '../llm/client';
import { evaluationOutput, inspirationOutput, templatesOutput, titleOutput } from '../llm/schemas';
import { PROMPTS } from '../prompts';
import { findEssay } from '../repositories/essays';
import { saveEvaluation } from '../repositories/history';
import { saveInspiration } from '../repositories/inspirations';
import { loadAIConfig } from '../repositories/settings';
import { findEssaysForExtraction, insertTemplates } from '../repositories/templates';

export class ReviewService {
  constructor(
    private readonly db: Database,
    private readonly env: Env,
  ) {}

  /** 已保存的配置；未保存密钥时回落到 Worker secret */
  async config(override?: Partial<AIConfig>): Promise<AIConfig> {
    const stored = { ...(await loadAIConfig(this.db)), ...override };
    return { ...stored, apiKey: stored.apiKey || this.env.AI_API_KEY || '' };
  }

  async evaluate(essayId: string): Promise<{ evaluation: Evaluation; version: Version }> {
    const essay = await this.answeredEssay(essayId);
    const report = await this.runEvaluation(essay.subject, essay, await this.config());
    return saveEvaluation(this.db, essay, report);
  }

  async inspire(essayId: string): Promise<Inspiration> {
    const essay = await this.answeredEssay(essayId);
    const report = await this.runInspiration(essay.subject, essay, await this.config());
    return saveInspiration(this.db, essay, report);
  }

  async suggestTitle(essayId: string): Promise<string> {
    const essay = await findEssay(this.db, essayId);
    const { title } = await chatJson(
      await this.config(),
      {
        system: PROMPTS[essay.subject].title,
        user: `题型：${TYPE_SPECS[essay.type].label}\n题目要求：${essay.prompt || '无'}\n作答正文：${essay.content || '无'}`,
      },
      titleOutput,
    );
    return title;
  }

  async extractTemplates({ subject, essayId }: ExtractTemplatesInput): Promise<Template[]> {
    const sources = (await findEssaysForExtraction(this.db, subject, essayId ? [essayId] : undefined)).filter((essay) => essay.content.trim());
    if (sources.some((essay) => essay.subject !== subject)) {
      throw badRequest(subject === 'politics' ? '这篇不是政治作答，不能提取进政治金句库' : '这篇不是英语作文，不能提取进英语语料库');
    }
    if (!sources.length) throw badRequest(subject === 'politics' ? '没有可提取的政治作答正文' : '没有可提取的英语作文正文');
    return this.runTemplateExtraction(subject, sources, await this.config());
  }

  async testConnection(override: Partial<AIConfig>): Promise<string> {
    const reply = await chat(await this.config(override), { user: 'Say "Connection successful" in English.', maxTokens: 100 });
    return reply.trim();
  }

  // ---------- 科目泛型实现 ----------

  private runEvaluation<S extends Subject>(subject: S, essay: EssayOf<S>, config: AIConfig) {
    return chatJson(config, PROMPTS[subject].evaluation(essay), evaluationOutput(subject, TYPE_SPECS[essay.type].maxScore));
  }

  private runInspiration<S extends Subject>(subject: S, essay: EssayOf<S>, config: AIConfig) {
    return chatJson(config, PROMPTS[subject].inspiration(essay), inspirationOutput(subject));
  }

  private async runTemplateExtraction<S extends Subject>(subject: S, sources: Pick<Essay, 'id' | 'title' | 'type' | 'prompt' | 'content'>[], config: AIConfig) {
    const corpus = sources
      .map((essay) => `【ID】${essay.id}\n【标题】${essay.title}\n【类型】${TYPE_SPECS[essay.type].label}\n【题目】${essay.prompt || '无'}\n【正文】\n${essay.content}`)
      .join('\n\n---\n\n');
    const drafts = await chatJson(config, { system: PROMPTS[subject].templates, user: `请整理以下作答：\n\n${corpus}` }, templatesOutput(subject));
    // 例句来自哪篇作答，就把句式归到哪篇；找不到时归到第一篇
    const sourceOf = (example: string) => {
      const probe = example.trim().slice(0, 24);
      const essay = (probe && sources.find((item) => item.content.includes(probe))) || sources[0]!;
      return { essayId: essay.id, title: essay.title };
    };
    return insertTemplates(
      this.db,
      subject,
      drafts.map((draft) => ({ ...draft, source: sourceOf(draft.example) })),
    );
  }

  private async answeredEssay(essayId: string): Promise<Essay> {
    const essay = await findEssay(this.db, essayId);
    if (!essay.content.trim()) throw badRequest('作答内容为空');
    return essay;
  }
}
