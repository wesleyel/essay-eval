/**
 * 作答的分类与主题标签。
 *
 * - 分类（category）：题型之下的一级归类，各题型的候选值互不相交（Part A 的“书信”不会出现在 Part B 下）。
 *   政治各题型本身已是最细的分类，没有二级分类，category 恒为空串。
 * - 主题标签（tags）：作文表述的主题，如“坚持”“环保”，可以有多个，自由填写。
 */
import type { EssayType } from './subject';

export const ESSAY_CATEGORIES = {
  /** 小作文按写作目的分；文体（书信 / 电子邮件）不影响写法，可记为主题标签 */
  'part-a': ['建议信', '推荐信', '邀请信', '致歉信', '申请求助信', '咨询回复', '通知'],
  /** 大作文先分图画 / 图表，再按主题或图表形式细分 */
  'part-b': ['图画·人生态度', '图画·品德情感', '图画·教育成长', '图画·文化社会', '图表·柱状图', '图表·表格', '图表·组合图'],
  mayuan: [],
  maozhongte: [],
  shigang: [],
  defa: [],
  dangdai: [],
} as const satisfies Record<EssayType, readonly string[]>;

export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 20;

export const categoriesOf = (type: EssayType): readonly string[] => ESSAY_CATEGORIES[type];

/** 该题型是否需要声明分类 */
export const needsCategory = (type: EssayType) => categoriesOf(type).length > 0;

/** 切换题型时使用：该题型的第一个分类；没有分类的题型为空串 */
export const defaultCategory = (type: EssayType): string => categoriesOf(type)[0] ?? '';

/** 去空白、去重，保持首次出现的顺序 */
export function normalizeTags(tags: readonly string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

/** 题型与分类是否匹配；返回错误说明，合法则为 null */
export function categoryError(type: EssayType, category: string): string | null {
  const allowed = categoriesOf(type);
  if (!allowed.length) return category ? '该题型没有分类，请留空' : null;
  return allowed.includes(category) ? null : `请选择分类：${allowed.join(' / ')}`;
}

/** 新建时的完整校验：分类匹配，且至少一个主题标签 */
export function classificationError(type: EssayType, category: string, tags: readonly string[]): string | null {
  const error = categoryError(type, category);
  if (error) return error;
  if (!normalizeTags(tags).length) return '请至少添加一个主题标签';
  if (tags.length > MAX_TAGS) return `主题标签最多 ${MAX_TAGS} 个`;
  return null;
}

/** 更新时的校验：只在题型或分类被改动时检查两者是否仍然匹配 */
export function patchCategoryError(current: { type: EssayType; category: string }, patch: { type?: EssayType; category?: string }): string | null {
  if (patch.type === undefined && patch.category === undefined) return null;
  return categoryError(patch.type ?? current.type, patch.category ?? current.category);
}

const hasAny = (text: string, words: readonly string[]) => words.some((word) => text.includes(word));

/**
 * 为没有分类的旧作答推断分类：看标题与题目文字，推断不出就取默认值（可在界面里改）。
 * 与迁移 0001 里的 SQL 规则保持一致。
 */
export function inferCategory(type: EssayType, title: string, prompt: string): string {
  const text = `${title} ${prompt}`.toLowerCase();
  if (type === 'part-a') {
    if (hasAny(text, ['notice', 'announcement', 'poster', 'memo', '通知', '告示'])) return '通知';
    if (hasAny(text, ['apolog', 'sorry', '致歉', '道歉'])) return '致歉信';
    if (hasAny(text, ['resign', 'apply', 'application', '辞职', '申请', '求助', '请求帮助'])) return '申请求助信';
    if (hasAny(text, ['recommend', '推荐'])) return '推荐信';
    if (hasAny(text, ['invit', '邀请'])) return '邀请信';
    if (hasAny(text, ['reply', 'respond', '回复', '回信', '咨询'])) return '咨询回复';
    return '建议信';
  }
  if (type === 'part-b') {
    const bar = hasAny(text, ['bar chart', '柱状']);
    const table = hasAny(text, ['table', '表格']);
    const pie = hasAny(text, ['pie', '饼']);
    if ((pie && bar) || (pie && table)) return '图表·组合图';
    if (pie) return '图表·组合图';
    if (table) return '图表·表格';
    if (bar || hasAny(text, ['chart', 'graph', 'figure', '图表', '折线'])) return '图表·柱状图';
    return '图画·人生态度';
  }
  return '';
}
