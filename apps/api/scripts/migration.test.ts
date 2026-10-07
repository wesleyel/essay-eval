import { ESSAY_CATEGORIES } from '@essay/domain';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('迁移 0001', () => {
  const sql = readFileSync(new URL('../migrations/0001_essay_classification.sql', import.meta.url), 'utf8');

  it('触发器里的分类清单与领域常量一致', () => {
    for (const type of ['part-a', 'part-b'] as const) {
      const list = ESSAY_CATEGORIES[type].map((name) => `'${name}'`).join(', ');
      expect(sql).toContain(`NEW.type = '${type}' AND NEW.category IN (${list})`);
    }
  });
});
