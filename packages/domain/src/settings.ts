import { z } from 'zod';

export const REASONING_EFFORTS = ['auto', 'none', 'low', 'medium', 'high'] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export interface AIConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  reasoningEffort: ReasoningEffort;
}

export const DEFAULT_AI_CONFIG: AIConfig = {
  baseUrl: 'https://api.deepseek.com',
  apiKey: '',
  model: 'deepseek-chat',
  reasoningEffort: 'auto',
};

/** 返回给浏览器的设置：密钥只留在服务端 */
export type AISettingsView = Omit<AIConfig, 'apiKey'> & { apiKeySet: boolean };

export const aiSettingsInput = z.object({
  baseUrl: z.url(),
  model: z.string().trim().min(1),
  reasoningEffort: z.enum(REASONING_EFFORTS),
  /** 省略表示沿用已保存的密钥；空串表示清除 */
  apiKey: z.string().trim().optional(),
});
export type AISettingsInput = z.infer<typeof aiSettingsInput>;

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
}
