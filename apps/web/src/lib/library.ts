import type { Subject, Template } from '@essay/domain';

/** 语料库独立页面的地址（新标签页打开），科目通过查询参数传递 */
export function libraryHref(subject: Subject) {
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}/library/?subject=${subject}`;
}

/** 组合稿的三个段落位置 */
export const POSITIONS = [
  { name: '开头', hint: '引出话题、说明目的或定性' },
  { name: '主体', hint: '原因、例证、对比与转折' },
  { name: '结尾', hint: '总结、建议或升华' },
] as const;
export type Position = (typeof POSITIONS)[number]['name'];

const POSITION_OF: Record<string, Position> = {
  开头破题: '开头',
  观点表达: '开头',
  原理定性: '开头',
  结尾收束: '结尾',
  总结升华: '结尾',
};
const CLOSING = /hope|appreciate|look forward|thank|期待|希望/i;

export function positionOf(template: Pick<Template, 'category' | 'pattern'>): Position {
  const fixed = POSITION_OF[template.category];
  if (fixed) return fixed;
  if (template.category === '书信功能') return CLOSING.test(template.pattern) ? '结尾' : '开头';
  return '主体';
}

export interface Segment {
  text: string;
  kind: 'plain' | 'hit' | 'slot';
}

/** 按搜索词切分高亮；needle 需已转小写 */
export function highlight(text: string, needle: string): Segment[] {
  if (!needle) return [{ text, kind: 'plain' }];
  const lower = text.toLowerCase();
  const out: Segment[] = [];
  let i = 0;
  while (i < text.length) {
    const j = lower.indexOf(needle, i);
    if (j < 0) {
      out.push({ text: text.slice(i), kind: 'plain' });
      break;
    }
    if (j > i) out.push({ text: text.slice(i, j), kind: 'plain' });
    out.push({ text: text.slice(j, j + needle.length), kind: 'hit' });
    i = j + needle.length;
  }
  return out;
}

/** 句型模板：[槽位] 单独标出，其余部分参与搜索高亮 */
export function patternSegments(pattern: string, needle = ''): Segment[] {
  return pattern
    .split(/(\[[^\]]+\])/)
    .filter(Boolean)
    .flatMap<Segment>((part) => (/^\[/.test(part) ? [{ text: part, kind: 'slot' }] : highlight(part, needle)));
}

export interface SavedCombo {
  id: string;
  name: string;
  templateIds: string[];
  savedAt: string;
}

export function isSavedCombos(value: unknown): value is SavedCombo[] {
  return (
    Array.isArray(value) &&
    value.every((item) => item && typeof item.id === 'string' && typeof item.name === 'string' && Array.isArray(item.templateIds) && typeof item.savedAt === 'string')
  );
}
