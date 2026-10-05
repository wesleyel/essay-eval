import { CORRECTION_LABELS, DIMENSION_KEYS, DIMENSIONS, LENGTH_UNIT, TYPE_SPECS, type Backup, type EssayDetail } from '@essay/domain';
import { COPY } from './copy';
import { download } from './download';

const date = (iso: string) => new Date(iso).toLocaleString();

export function essayToMarkdown({ essay, evaluations }: EssayDetail): string {
  const copy = COPY[essay.subject];
  const lines = [
    `# ${essay.title}`,
    '',
    `- **板块**：${copy.tab}`,
    `- **题型**：${TYPE_SPECS[essay.type].label}`,
    `- **标签**：${[essay.category, ...essay.tags].filter(Boolean).join('、') || '无'}`,
    `- **篇幅**：${essay.wordCount} ${LENGTH_UNIT[essay.subject]}`,
    `- **更新时间**：${date(essay.updatedAt)}`,
    '',
    '## 题目要求',
    '',
    `> ${essay.prompt.replace(/\n/g, '\n> ')}`,
    '',
    '## 作答原文',
    '',
    essay.content,
    '',
  ];

  const latest = evaluations[0];
  if (latest) {
    lines.push('## AI 评分报告', '', `- **总分**：**${latest.score}** / ${latest.maxScore}（${latest.band}）`);
    for (const key of DIMENSION_KEYS) {
      const dimension = latest.dimensions[key];
      lines.push(`- **${DIMENSIONS[essay.subject][key].label}**：${dimension.score}/${dimension.maxScore}（${dimension.feedback}）`);
    }
    lines.push('', `### ${copy.evaluation.overall}`, '', latest.overallComment, '');
    if (latest.corrections.length) {
      lines.push('### 纠错明细', '');
      latest.corrections.forEach((item, index) =>
        lines.push(`${index + 1}. **[${CORRECTION_LABELS[item.kind]}]** \`${item.original}\` → \`${item.corrected}\`（${item.explanation}）`),
      );
      lines.push('');
    }
    lines.push(`### ${copy.polished}`, '', latest.polished, '');
  }

  if (evaluations.length > 1) {
    lines.push('## 历次评分', '');
    [...evaluations].reverse().forEach((item, index) => lines.push(`${index + 1}. ${date(item.createdAt)}：**${item.score}** / ${item.maxScore}（${item.band}）`));
    lines.push('');
  }
  return lines.join('\n');
}

export const downloadMarkdown = (detail: EssayDetail) => download(`${detail.essay.title}.md`, essayToMarkdown(detail), 'text/markdown;charset=utf-8');

export const downloadBackup = (backup: Backup) =>
  download(`essay-eval-backup-${backup.exportedAt.slice(0, 10)}.json`, JSON.stringify(backup, null, 2), 'application/json');
