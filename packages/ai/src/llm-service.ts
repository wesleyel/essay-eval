/**
 * 评分、启发、标题、语料提取的纯模型调用（不碰存储），Worker 与浏览器共用。
 * 每个操作都写成以科目为类型参数的泛型函数（correlated union 模式），
 * 由 PROMPTS[subject] 与对应的输出 schema 决定行为，科目之间零重复。
 */
import {
  TYPE_SPECS,
  type AIConfig,
  type Essay,
  type EssayOf,
  type EvaluationReport,
  type InspirationReport,
  type Subject,
  type TemplateDraft,
} from '@essay/domain';
import { chatJson } from './client';
import { PROMPTS } from './prompts';
import { evaluationOutput, inspirationOutput, templatesOutput, titleOutput } from './schemas';

export type ExtractionSource = Pick<Essay, 'id' | 'title' | 'type' | 'prompt' | 'content'>;
export type SourcedDraft = TemplateDraft & { source: { essayId: string; title: string } };

export function runEvaluation<S extends Subject>(subject: S, essay: EssayOf<S>, config: AIConfig): Promise<EvaluationReport<S>> {
  return chatJson(config, PROMPTS[subject].evaluation(essay), evaluationOutput(subject, TYPE_SPECS[essay.type].maxScore));
}

export function runInspiration<S extends Subject>(subject: S, essay: EssayOf<S>, config: AIConfig): Promise<InspirationReport<S>> {
  return chatJson(config, PROMPTS[subject].inspiration(essay), inspirationOutput(subject));
}

export async function runTitle(config: AIConfig, essay: Essay): Promise<string> {
  const { title } = await chatJson(
    config,
    {
      system: PROMPTS[essay.subject].title,
      user: `题型：${TYPE_SPECS[essay.type].label}\n题目要求：${essay.prompt || '无'}\n作答正文：${essay.content || '无'}`,
    },
    titleOutput,
  );
  return title;
}

export async function runTemplateExtraction<S extends Subject>(subject: S, sources: ExtractionSource[], config: AIConfig): Promise<SourcedDraft[]> {
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
  return drafts.map((draft) => ({ ...draft, source: sourceOf(draft.example) }));
}
