/**
 * 浏览器端的 "API"：与 Worker 同样的路径与契约，数据在 IndexedDB，模型由浏览器直连。
 * 密钥只存在本机浏览器里。
 */
import {
  aiSettingsInput,
  createEssayInput,
  createVersionInput,
  essayListQuery,
  extractTemplatesInput,
  templateListQuery,
  updateEssayInput,
  type AIConfig,
  type AISettingsView,
  type ConnectionTestResult,
  type Essay,
} from '@essay/domain';
import { AppError, badRequest, chat, runEvaluation, runInspiration, runTemplateExtraction, runTitle } from '@essay/ai';
import type { z } from 'zod';
import * as store from './store';

type Params = Record<string, string>;
type Ctx = { params: Params; query: URLSearchParams; body: unknown };
type Handler = (ctx: Ctx) => Promise<unknown>;

const parse = <T extends z.ZodType>(schema: T, value: unknown): z.infer<T> => {
  const result = schema.safeParse(value);
  if (!result.success) throw badRequest(result.error.issues.map((issue) => `${issue.path.join('.') || '参数'}: ${issue.message}`).join('；'));
  return result.data;
};
const queryObject = (query: URLSearchParams) => Object.fromEntries(query);

const toView = ({ apiKey, ...config }: AIConfig): AISettingsView => ({ ...config, apiKeySet: Boolean(apiKey) });

async function answeredEssay(id: string): Promise<Essay> {
  const essay = await store.findEssay(id);
  if (!essay.content.trim()) throw badRequest('作答内容为空');
  return essay;
}

const routes: { method: string; pattern: RegExp; handle: Handler; status?: number }[] = [];
const route = (method: string, path: string, handle: Handler, status = 200) =>
  routes.push({ method, pattern: new RegExp(`^${path.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`), handle, status });

route('GET', '/essays', ({ query }) => store.listEssays(parse(essayListQuery, queryObject(query))));
route('POST', '/essays', ({ body }) => store.createEssay(parse(createEssayInput, body)), 201);
route('GET', '/essays/:id', ({ params }) => store.getEssay(params.id!));
route('PATCH', '/essays/:id', ({ params, body }) => store.updateEssay(params.id!, parse(updateEssayInput, body)));
route('DELETE', '/essays/:id', ({ params }) => store.deleteEssay(params.id!), 204);

route('POST', '/essays/:id/versions', ({ params, body }) => store.createSnapshot(params.id!, parse(createVersionInput, body).note), 201);
route('DELETE', '/essays/:id/versions/:versionId', ({ params }) => store.deleteVersion(params.id!, params.versionId!), 204);
route('DELETE', '/essays/:id/evaluations/:evaluationId', ({ params }) => store.deleteEvaluation(params.id!, params.evaluationId!), 204);

route(
  'POST',
  '/essays/:id/evaluations',
  async ({ params }) => {
    const essay = await answeredEssay(params.id!);
    const report = await runEvaluation(essay.subject, essay, await store.loadAIConfig());
    return store.saveEvaluation(essay.id, report);
  },
  201,
);
route('POST', '/essays/:id/inspiration', async ({ params }) => {
  const essay = await answeredEssay(params.id!);
  const report = await runInspiration(essay.subject, essay, await store.loadAIConfig());
  return store.saveInspiration(essay.id, report);
});
route('POST', '/essays/:id/title', async ({ params }) => ({ title: await runTitle(await store.loadAIConfig(), await store.findEssay(params.id!)) }));

route('GET', '/templates', ({ query }) => store.listTemplates(parse(templateListQuery, queryObject(query)).subject));
route(
  'POST',
  '/templates/extract',
  async ({ body }) => {
    const { subject, essayId } = parse(extractTemplatesInput, body);
    const sources = (await store.listExtractionSources(subject, essayId)).filter((essay) => essay.content.trim());
    if (sources.some((essay) => essay.subject !== subject)) {
      throw badRequest(subject === 'politics' ? '这篇不是政治作答，不能提取进政治金句库' : '这篇不是英语作文，不能提取进英语语料库');
    }
    if (!sources.length) throw badRequest(subject === 'politics' ? '没有可提取的政治作答正文' : '没有可提取的英语作文正文');
    return store.insertTemplates(subject, await runTemplateExtraction(subject, sources, await store.loadAIConfig()));
  },
  201,
);
route('DELETE', '/templates/:id', ({ params }) => store.deleteTemplate(params.id!), 204);

route('GET', '/settings', async () => toView(await store.loadAIConfig()));
route('PUT', '/settings', async ({ body }) => {
  const { apiKey, ...rest } = parse(aiSettingsInput, body);
  return toView(await store.saveAIConfig({ ...rest, apiKey: apiKey ?? (await store.loadAIConfig()).apiKey }));
});
route('POST', '/settings/test', async ({ body }): Promise<ConnectionTestResult> => {
  const { apiKey, ...rest } = parse(aiSettingsInput, body);
  const stored = await store.loadAIConfig();
  try {
    const reply = await chat({ ...stored, ...rest, apiKey: apiKey || stored.apiKey }, { user: 'Say "Connection successful" in English.', maxTokens: 100 });
    return { ok: true, message: `连通成功！模型回复：${reply.trim()}` };
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    return { ok: false, message: `测试连通失败：${error.message}` };
  }
});
route('GET', '/backup', () => store.exportBackup());

/** 返回 { status, data }，与 fetch 的语义对齐 */
export async function handleLocal(method: string, path: string, body?: unknown): Promise<{ status: number; data: unknown }> {
  const url = new URL(path, 'http://local');
  for (const { method: m, pattern, handle, status } of routes) {
    if (m !== method) continue;
    const match = pattern.exec(url.pathname);
    if (!match) continue;
    try {
      const data = await handle({ params: { ...match.groups }, query: url.searchParams, body });
      return { status: status === 204 ? 204 : (status ?? 200), data };
    } catch (error) {
      if (error instanceof AppError) return { status: error.status, data: { error: error.message } };
      console.error(error);
      return { status: 500, data: { error: '本地存储出错，请刷新后重试' } };
    }
  }
  return { status: 404, data: { error: '接口不存在' } };
}
