import { TYPE_SPECS, type EssayType, type Subject } from './subject';

const CJK = /[一-龥]/g;
const WORD = /[a-zA-Z0-9'-]+/g;

/** 英语按词计数；政治按汉字计数，夹杂的英文/数字按词计。 */
export function countWords(text: string, subject: Subject): number {
  if (!text.trim()) return 0;
  if (subject === 'english') return text.match(WORD)?.length ?? 0;
  const cjk = text.match(CJK)?.length ?? 0;
  const rest = text.replace(CJK, ' ').match(WORD)?.length ?? 0;
  return cjk + rest;
}

export const LENGTH_UNIT: Record<Subject, string> = { english: '词', politics: '字' };

/**
 * 差异比对的切分粒度：英语按词，政治按字。
 * 中文没有空格，按词切会把整段当成一处修改。
 */
export function tokenize(text: string, subject: Subject): string[] {
  const pattern = subject === 'english' ? /[a-zA-Z0-9'-]+|\s+|[^\s]/g : /[一-龥]|[a-zA-Z0-9'-]+|\s+|[^\s]/g;
  return text.match(pattern) ?? [];
}

export type LengthStatus =
  | { kind: 'empty' }
  | { kind: 'short'; missing: number }
  | { kind: 'ok' }
  | { kind: 'long'; excess: number };

export function lengthStatus(count: number, type: EssayType): LengthStatus {
  const { min, max } = TYPE_SPECS[type].length;
  if (count === 0) return { kind: 'empty' };
  if (count < min) return { kind: 'short', missing: min - count };
  if (count > max) return { kind: 'long', excess: count - max };
  return { kind: 'ok' };
}
