import { describe, expect, it } from 'vitest';
import { completionsUrl, parseLooseJson } from './client';
import { evaluationOutput, inspirationOutput, templatesOutput } from './schemas';

describe('completionsUrl', () => {
  it.each([
    ['https://api.deepseek.com', 'https://api.deepseek.com/v1/chat/completions'],
    ['https://api.openai.com/v1/', 'https://api.openai.com/v1/chat/completions'],
    ['https://x.dev/v1/chat/completions', 'https://x.dev/v1/chat/completions'],
  ])('%s', (input, expected) => expect(completionsUrl(input)).toBe(expected));
});

describe('parseLooseJson', () => {
  it('extracts fenced JSON and tolerates comments and trailing commas', () => {
    const raw = '说明\n```json\n{"a": 1, // note\n "url": "https://x.dev/a", "b": [1, 2,],}\n```';
    expect(parseLooseJson(raw)).toEqual({ a: 1, url: 'https://x.dev/a', b: [1, 2] });
  });
  it('prefers a top-level array when it comes first', () => {
    expect(parseLooseJson('here: [{"a":1},{"b":2}] done')).toEqual([{ a: 1 }, { b: 2 }]);
  });
});

describe('evaluationOutput', () => {
  it('clamps scores to the spec and maps model fields to domain names', () => {
    const report = evaluationOutput('politics', 10).parse({
      score: 12,
      dimensions: { content: { score: 9, feedback: 'f' } },
      corrections: [{ original: 'a', corrected: 'b', type: 'spelling' }, { original: '' }],
      polishedEssay: 'p',
    });
    expect(report.score).toBe(10);
    expect(report.dimensions.content).toEqual({ score: 3.5, maxScore: 3.5, feedback: 'f' });
    expect(report.dimensions.language).toEqual({ score: 0, maxScore: 2, feedback: '' });
    // 英语专属的 spelling 在政治里回落为政治类别
    expect(report.corrections).toEqual([{ id: 'c1', kind: 'concept', original: 'a', corrected: 'b', explanation: '' }]);
    expect(report.polished).toBe('p');
  });
  it('rejects a report without a polished text', () => {
    expect(evaluationOutput('english', 20).safeParse({ score: 10 }).success).toBe(false);
  });
});

describe('inspirationOutput / templatesOutput', () => {
  it('drops invalid items instead of failing', () => {
    const report = inspirationOutput('english').parse({
      extractedSentences: [{ originalSentence: 'x', functionType: 'principle', advancedVariations: ['y'] }, { functionType: 'opening' }],
      synonymUpgrades: 'oops',
    });
    expect(report.sentences).toEqual([{ original: 'x', function: 'opening', variations: ['y'], critique: '' }]);
    expect(report.upgrades).toEqual([]);
  });
  it('accepts wrapped arrays and normalises categories', () => {
    const drafts = templatesOutput('english').parse({ templates: [{ template: 'It is [adj] that', category: '原理定性' }, { usage: 'no pattern' }] });
    expect(drafts).toEqual([{ pattern: 'It is [adj] that', category: '其他', usage: '', example: '' }]);
  });
});

describe('no-op suggestions are dropped', () => {
  it('drops corrections and rewrites that change nothing', () => {
    const report = evaluationOutput('english', 10).parse({
      score: 8,
      corrections: [
        { original: 'I am glad.', corrected: 'i am glad', type: 'polish' },
        { original: 'He go', corrected: 'He goes', type: 'grammar' },
      ],
      polishedEssay: 'p',
    });
    expect(report.corrections.map((item) => item.corrected)).toEqual(['He goes']);

    const inspiration = inspirationOutput('english').parse({
      extractedSentences: [
        { originalSentence: 'It is good.', advancedVariations: ['It is good', 'It is good!'] },
        { originalSentence: 'It rains. I stay home.', advancedVariations: ['Because it rains, I stay home.', 'because it rains I stay home', 'It rains. I stay home.'] },
      ],
      synonymUpgrades: [
        { originalWord: 'help', substitutes: [{ word: 'Help' }] },
        { originalWord: 'make', substitutes: [{ word: 'make' }, { word: 'enable' }] },
      ],
    });
    expect(inspiration.sentences).toHaveLength(1);
    expect(inspiration.sentences[0]?.variations).toEqual(['Because it rains, I stay home.']);
    expect(inspiration.upgrades.map((item) => [item.word, item.substitutes.map((substitute) => substitute.word)])).toEqual([['make', ['enable']]]);
  });
});
