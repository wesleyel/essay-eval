import { z } from 'zod';
import type { Evaluation, EvaluationSummary, Inspiration, SourceSnapshot } from './review';
import { ALL_ESSAY_TYPES, ESSAY_TYPES, SUBJECTS, type EssayKind, type Subject } from './subject';
import type { Template } from './template';

// ---------- 实体 ----------

export type Essay = EssayKind & {
  id: string;
  title: string;
  category: string;
  tags: string[];
  prompt: string;
  /** 题目图片，data URL */
  promptImage: string | null;
  content: string;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
};

/** 某一科目的作答 */
export type EssayOf<S extends Subject> = Extract<Essay, { subject: S }>;

/** 列表项：不带图片，附带评分统计 */
export type EssaySummary = Omit<Essay, 'promptImage'> & {
  hasPromptImage: boolean;
  latestEvaluation: EvaluationSummary | null;
  evaluationCount: number;
  versionCount: number;
};

export interface Version {
  id: string;
  essayId: string;
  note: string;
  title: string;
  source: SourceSnapshot;
  wordCount: number;
  /** 由评分自动生成的版本带评分 id；手动快照为 null */
  evaluationId: string | null;
  createdAt: string;
}

export interface EssayDetail {
  essay: Essay;
  /** 新的在前 */
  evaluations: Evaluation[];
  /** 新的在前 */
  versions: Version[];
  inspiration: Inspiration | null;
}

export function snapshotOf(essay: Pick<Essay, 'type' | 'prompt' | 'content'>): SourceSnapshot {
  return { type: essay.type, prompt: essay.prompt, content: essay.content };
}

// ---------- 输入 ----------

/** D1 单行上限约 2MB，题目图片在前端压缩后应远小于此 */
export const MAX_PROMPT_IMAGE_LENGTH = 1_200_000;

const promptImage = z
  .string()
  .regex(/^data:image\/[a-z+.-]+;base64,/, '题目图片必须是图片 data URL')
  .max(MAX_PROMPT_IMAGE_LENGTH, '题目图片过大');

const editableFields = {
  title: z.string().trim().max(200),
  category: z.string().trim().max(100),
  tags: z.array(z.string().trim().min(1).max(50)).max(30),
  prompt: z.string().max(20_000),
  promptImage: promptImage.nullable(),
  content: z.string().max(50_000),
};

const createVariant = <S extends Subject>(subject: S) =>
  z.object({
    subject: z.literal(subject),
    type: z.enum(ESSAY_TYPES[subject]).optional(),
    ...editableFields,
  }).partial({ title: true, category: true, tags: true, prompt: true, promptImage: true, content: true });

export const createEssayInput = z.discriminatedUnion('subject', [createVariant('english'), createVariant('politics')]);
export type CreateEssayInput = z.infer<typeof createEssayInput>;

/** 科目一经创建不可更改；题型只能在本科目内切换（服务端校验） */
export const updateEssayInput = z
  .object({ type: z.enum(ALL_ESSAY_TYPES), ...editableFields })
  .partial()
  .strict();
export type UpdateEssayInput = z.infer<typeof updateEssayInput>;

export const essayListQuery = z.object({
  subject: z.enum(SUBJECTS).optional(),
  type: z.enum(ALL_ESSAY_TYPES).optional(),
});
export type EssayListQuery = z.infer<typeof essayListQuery>;

export const createVersionInput = z.object({ note: z.string().trim().max(200).optional() });
export type CreateVersionInput = z.infer<typeof createVersionInput>;

export const extractTemplatesInput = z.object({
  subject: z.enum(SUBJECTS),
  /** 省略时从该科目全部有正文的作答中提取 */
  essayId: z.string().optional(),
});
export type ExtractTemplatesInput = z.infer<typeof extractTemplatesInput>;

export const templateListQuery = z.object({ subject: z.enum(SUBJECTS).optional() });

// ---------- 备份 ----------

export interface Backup {
  exportedAt: string;
  essays: EssayDetail[];
  templates: Template[];
}
