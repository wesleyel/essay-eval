import { describe, expect, it } from 'vitest';
import { categoryError, classificationError, ESSAY_CATEGORIES, inferCategory, normalizeTags } from './classification';
import { ALL_ESSAY_TYPES } from './subject';

describe('essay classification', () => {
  it('旧作答按题目文字推断分类', () => {
    expect(inferCategory('part-a', '回复朋友', 'write a reply e-mail')).toBe('咨询回复');
    expect(inferCategory('part-a', '辞职信', 'Write a letter to your boss')).toBe('申请求助信');
    expect(inferCategory('part-a', '歌唱比赛', 'Write a notice')).toBe('通知');
    expect(inferCategory('part-a', '推荐电影', 'recommend a film')).toBe('推荐信');
    expect(inferCategory('part-a', 'x', '')).toBe('建议信');
    expect(inferCategory('part-b', 'x', 'the following bar chart')).toBe('图表·柱状图');
    expect(inferCategory('part-b', 'x', 'a table')).toBe('图表·表格');
    expect(inferCategory('part-b', 'x', 'pie chart and bar chart')).toBe('图表·组合图');
    expect(inferCategory('part-b', 'x', 'the picture')).toBe('图画·人生态度');
    expect(inferCategory('mayuan', 'x', '')).toBe('');
  });

  it('各题型的分类互不相交', () => {
    const all = ALL_ESSAY_TYPES.flatMap((type) => ESSAY_CATEGORIES[type]);
    expect(new Set(all).size).toBe(all.length);
  });

  it('分类必须属于所选题型', () => {
    expect(categoryError('part-a', '推荐信')).toBeNull();
    expect(categoryError('part-a', '建议信')).toBeNull();
    expect(categoryError('part-a', '图表·表格')).not.toBeNull();
    expect(categoryError('part-b', '建议信')).not.toBeNull();
    expect(categoryError('part-a', '')).not.toBeNull();
    expect(categoryError('mayuan', '')).toBeNull();
    expect(categoryError('mayuan', '推荐信')).not.toBeNull();
  });

  it('至少需要一个主题标签', () => {
    expect(classificationError('part-b', '图画·人生态度', [])).not.toBeNull();
    expect(classificationError('part-b', '图画·人生态度', ['  '])).not.toBeNull();
    expect(classificationError('part-b', '图画·人生态度', ['坚持'])).toBeNull();
  });

  it('标签去空白并去重', () => {
    expect(normalizeTags([' 坚持 ', '坚持', '', '环保'])).toEqual(['坚持', '环保']);
  });
});
