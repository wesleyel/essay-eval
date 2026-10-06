import type { AIConfig } from '@essay/domain';
import type { z } from 'zod';
import { upstreamError } from './errors';

export interface ChatRequest {
  system?: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}

/** 兼容 OpenAI 协议的 chat/completions 地址；用户可能填根地址、/v1 或完整路径 */
export function completionsUrl(baseUrl: string): string {
  const root = baseUrl.trim().replace(/\/chat\/completions\/?$/, '').replace(/\/+$/, '');
  return `${/\/v\d+$/.test(root) ? root : `${root}/v1`}/chat/completions`;
}

/** o1/o3 等推理模型不接受 temperature */
const isReasoningModel = (model: string) => /^o\d/.test(model);

export async function chat(config: AIConfig, request: ChatRequest): Promise<string> {
  const body: Record<string, unknown> = {
    model: config.model,
    messages: [
      ...(request.system ? [{ role: 'system', content: request.system }] : []),
      { role: 'user', content: request.user },
    ],
  };
  if (config.reasoningEffort !== 'auto') body.reasoning_effort = config.reasoningEffort;
  if (!isReasoningModel(config.model)) body.temperature = request.temperature ?? 0.2;
  if (request.maxTokens) body.max_tokens = request.maxTokens;

  let response: Response;
  try {
    response = await fetch(completionsUrl(config.baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey || 'none'}` },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw upstreamError(`无法连接模型服务：${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response.ok) {
    throw upstreamError(`模型服务返回 ${response.status}：${(await response.text()).slice(0, 300)}`);
  }
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? '';
}

/** 请求模型并按 schema 校验其 JSON 输出 */
export async function chatJson<T>(config: AIConfig, request: ChatRequest, schema: z.ZodType<T>): Promise<T> {
  const raw = await chat(config, request);
  const result = schema.safeParse(parseLooseJson(raw));
  if (!result.success) {
    console.error('LLM output rejected', result.error.issues, raw);
    throw upstreamError('模型返回的结构不完整，请重试');
  }
  return result.data;
}

/** 从模型回复中取出 JSON：容忍 Markdown 代码块、前后废话、注释和尾逗号 */
export function parseLooseJson(raw: string): unknown {
  const text = extractJsonText(raw);
  try {
    return JSON.parse(text);
  } catch {
    try {
      return JSON.parse(text.replace(/(^|,)\s*\/\/[^\n]*$/gm, '$1').replace(/,\s*([}\]])/g, '$1'));
    } catch (error) {
      console.error('LLM JSON parse error', raw);
      throw upstreamError(`模型返回内容无法解析为 JSON：${error instanceof Error ? error.message : ''}`);
    }
  }
}

function extractJsonText(raw: string): string {
  let text = raw.trim();
  const blocks = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)].map((match) => match[1] ?? '');
  if (blocks.length) text = (blocks.find((block) => /[{[]/.test(block)) ?? blocks[0] ?? '').trim();

  const objectStart = text.indexOf('{');
  const arrayStart = text.indexOf('[');
  const isArray = arrayStart !== -1 && (objectStart === -1 || arrayStart < objectStart);
  const start = isArray ? arrayStart : objectStart;
  const end = text.lastIndexOf(isArray ? ']' : '}');
  return start !== -1 && end > start ? text.slice(start, end + 1) : text;
}
