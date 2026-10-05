import { describe, expect, it } from 'vitest';
import { countWords, lengthStatus, tokenize } from './text';
import { isTypeOf, subjectOfType } from './subject';
import { dimensionMax, DIMENSION_KEYS, DIMENSIONS } from './review';

describe('countWords', () => {
  it('counts English words', () => {
    expect(countWords("It's a well-known fact, 2026.", 'english')).toBe(5);
    expect(countWords('   ', 'english')).toBe(0);
  });
  it('counts Chinese characters plus embedded words', () => {
    expect(countWords('矛盾的同一性 GDP 增长', 'politics')).toBe(9);
  });
});

describe('tokenize', () => {
  it('splits politics text per character', () => {
    expect(tokenize('绿水青山', 'politics')).toEqual(['绿', '水', '青', '山']);
  });
});

describe('lengthStatus', () => {
  it('reports short / ok / long against the type range', () => {
    expect(lengthStatus(0, 'part-a')).toEqual({ kind: 'empty' });
    expect(lengthStatus(50, 'part-a')).toEqual({ kind: 'short', missing: 30 });
    expect(lengthStatus(100, 'part-a')).toEqual({ kind: 'ok' });
    expect(lengthStatus(210, 'part-b')).toEqual({ kind: 'long', excess: 10 });
  });
});

describe('subjects', () => {
  it('derives subject from type', () => {
    expect(subjectOfType('defa')).toBe('politics');
    expect(subjectOfType('part-b')).toBe('english');
    expect(isTypeOf('english', 'mayuan')).toBe(false);
  });
  it('dimension weights sum to the full score', () => {
    for (const subject of ['english', 'politics'] as const) {
      const total = DIMENSION_KEYS.reduce((sum, key) => sum + DIMENSIONS[subject][key].weight, 0);
      expect(total).toBeCloseTo(1);
    }
    expect(dimensionMax('politics', 10, 'content')).toBe(3.5);
    expect(dimensionMax('english', 20, 'language')).toBe(5);
  });
});
