import { tokenize, type Subject } from '@essay/domain';
import { diffArrays } from 'diff';

export interface DiffPart {
  value: string;
  change: 'added' | 'removed' | 'same';
}

/** 英语按词、政治按字对比 */
export function diffText(original: string, revised: string, subject: Subject): DiffPart[] {
  return diffArrays(tokenize(original, subject), tokenize(revised, subject)).map((part) => ({
    value: part.value.join(''),
    change: part.added ? 'added' : part.removed ? 'removed' : 'same',
  }));
}

/** 按段落配对后逐段对比，用于双栏视图 */
export function diffParagraphs(original: string, revised: string, subject: Subject): DiffPart[][] {
  const split = (text: string) => text.split(/\n+/).filter((paragraph) => paragraph.trim());
  const left = split(original);
  const right = split(revised);
  return Array.from({ length: Math.max(left.length, right.length) }, (_, index) => diffText(left[index] ?? '', right[index] ?? '', subject));
}
