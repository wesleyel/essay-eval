/**
 * 评分、启发、标题、语料提取。
 * 每个操作都写成以科目为类型参数的泛型函数（correlated union 模式），
 * 由 PROMPTS[subject] 与对应的输出 schema 决定行为，科目之间零重复。
 */
import {
  type AIConfig,
  type Essay,
  type Evaluation,
  type ExtractTemplatesInput,
  type Inspiration,
  type Template,
  type Version,
} from '@essay/domain';
import { badRequest, chat, runEvaluation, runInspiration, runTemplateExtraction, runTitle } from '@essay/ai';
import type { Database } from '../db/client';
import type { Env } from '../env';
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
    const report = await runEvaluation(essay.subject, essay, await this.config());
    return saveEvaluation(this.db, essay, report);
  }

  async inspire(essayId: string): Promise<Inspiration> {
    const essay = await this.answeredEssay(essayId);
    const report = await runInspiration(essay.subject, essay, await this.config());
    return saveInspiration(this.db, essay, report);
  }

  async suggestTitle(essayId: string): Promise<string> {
    const essay = await findEssay(this.db, essayId);
    return runTitle(await this.config(), essay);
  }

  async extractTemplates({ subject, essayId }: ExtractTemplatesInput): Promise<Template[]> {
    const sources = (await findEssaysForExtraction(this.db, subject, essayId ? [essayId] : undefined)).filter((essay) => essay.content.trim());
    if (sources.some((essay) => essay.subject !== subject)) {
      throw badRequest(subject === 'politics' ? '这篇不是政治作答，不能提取进政治金句库' : '这篇不是英语作文，不能提取进英语语料库');
    }
    if (!sources.length) throw badRequest(subject === 'politics' ? '没有可提取的政治作答正文' : '没有可提取的英语作文正文');
    const drafts = await runTemplateExtraction(subject, sources, await this.config());
    return insertTemplates(this.db, subject, drafts);
  }

  async testConnection(override: Partial<AIConfig>): Promise<string> {
    const reply = await chat(await this.config(override), { user: 'Say "Connection successful" in English.', maxTokens: 100 });
    return reply.trim();
  }

  private async answeredEssay(essayId: string): Promise<Essay> {
    const essay = await findEssay(this.db, essayId);
    if (!essay.content.trim()) throw badRequest('作答内容为空');
    return essay;
  }
}
