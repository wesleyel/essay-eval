import {
  CORRECTION_KINDS,
  DIMENSION_KEYS,
  DIMENSIONS,
  TEMPLATE_CATEGORIES,
  dimensionMax,
  type EssayOf,
  type Subject,
} from '@essay/domain';
import type { ChatRequest } from '../client';

/** 一个科目的全部提示词。新增科目时，类型会强制补齐每一项。 */
export interface SubjectPrompts<S extends Subject> {
  evaluation(essay: EssayOf<S>): ChatRequest;
  inspiration(essay: EssayOf<S>): ChatRequest;
  /** 标题生成的系统提示 */
  title: string;
  /** 语料/金句提取的系统提示 */
  templates: string;
}

/** 维度评分细则，由领域里的维度表生成 */
export function dimensionRubric(subject: Subject, maxScore: number): string {
  return DIMENSION_KEYS.map((key) => {
    const { label, criteria } = DIMENSIONS[subject][key];
    return `- dimensions.${key}（${label}，满分 ${dimensionMax(subject, maxScore, key)}）：${criteria}`;
  }).join('\n');
}

/** 评分 JSON 输出格式示例 */
export function evaluationShape(subject: Subject, maxScore: number, extra: { band: string; correction: string }): string {
  const dimensions = DIMENSION_KEYS.map(
    (key) => `    "${key}": { "score": ${Math.round(dimensionMax(subject, maxScore, key) * 8) / 10}, "maxScore": ${dimensionMax(subject, maxScore, key)}, "feedback": "${DIMENSIONS[subject][key].label}方面的简明反馈" }`,
  ).join(',\n');
  return `{
  "score": ${maxScore * 0.8},
  "maxScore": ${maxScore},
  "band": "${extra.band}",
  "dimensions": {
${dimensions}
  },
  "overallComment": "200字左右紧扣阅卷标准的考官总评",
  "strengths": ["得分亮点1（具体指出好在哪）", "得分亮点2"],
  "weaknesses": ["失分短板1（指明改进方向）", "失分短板2"],
  "corrections": [
    {
      "original": "原文中需要修改的局部表达（只收录确有问题之处）",
      "corrected": "${extra.correction}",
      "type": "${CORRECTION_KINDS[subject][0]}",
      "explanation": "修改理由"
    }
  ],
  "polishedEssay": "整篇修订后的全文"
}
其中 type 只能取：${CORRECTION_KINDS[subject].join(' | ')}。四个维度得分之和应等于 score，且每个维度不得超过自己的满分。`;
}

export const templateCategoryList = (subject: Subject) => TEMPLATE_CATEGORIES[subject].join('、');
