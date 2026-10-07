import type { EssayType, Subject } from './subject';

export const TEMPLATE_CATEGORIES = {
  english: ['开头破题', '图表描述', '原因分析', '举例论证', '转折衔接', '结尾收束', '书信功能', '观点表达', '其他'],
  politics: ['原理定性', '材料结合', '方法论对策', '时政金句', '史实表述', '分点衔接', '总结升华', '其他'],
} as const satisfies Record<Subject, readonly string[]>;

export type TemplateCategoryOf<S extends Subject> = (typeof TEMPLATE_CATEGORIES)[S][number];
export type TemplateCategory = TemplateCategoryOf<Subject>;

/** LLM 提取出的可复用句式 */
export interface TemplateDraft<S extends Subject = Subject> {
  pattern: string;
  category: TemplateCategoryOf<S>;
  usage: string;
  example: string;
}

export interface TemplateSource {
  essayId: string;
  title: string;
  type: EssayType;
  category: string;
  tags: string[];
}

export type Template<S extends Subject = Subject> = TemplateDraft<S> & {
  id: string;
  subject: S;
  /** 来源作答被删除后为 null；分类与主题标签取自来源作答的当前值，用于语料库筛选 */
  source: TemplateSource | null;
  createdAt: string;
};
