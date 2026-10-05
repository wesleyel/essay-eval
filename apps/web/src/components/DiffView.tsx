import type { Subject } from '@essay/domain';
import { useMemo, useState } from 'react';
import { COPY } from '../lib/copy';
import { diffParagraphs, diffText, type DiffPart } from '../lib/diff';
import { CopyButton, Segmented } from './ui';

type Mode = 'inline' | 'split' | 'revised';

interface Props {
  subject: Subject;
  original: string;
  revised: string;
  /** 右侧文本的名称，默认为科目的范文名 */
  revisedLabel?: string;
}

function Parts({ parts, hide }: { parts: DiffPart[]; hide?: DiffPart['change'] }) {
  return parts.map((part, index) =>
    part.change === hide ? null : (
      <span key={index} className={part.change === 'added' ? 'diff-add' : part.change === 'removed' ? 'diff-del' : undefined}>
        {part.value}
      </span>
    ),
  );
}

export function DiffView({ subject, original, revised, revisedLabel }: Props) {
  const copy = COPY[subject];
  const label = revisedLabel ?? copy.polished;
  const [mode, setMode] = useState<Mode>('inline');
  const parts = useMemo(() => diffText(original, revised, subject), [original, revised, subject]);
  const paragraphs = useMemo(() => (mode === 'split' ? diffParagraphs(original, revised, subject) : []), [mode, original, revised, subject]);
  const added = parts.filter((part) => part.change === 'added').length;
  const removed = parts.filter((part) => part.change === 'removed').length;

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2">
        <div className="flex gap-1.5 text-[11px]">
          <span className="chip border border-rose-200 bg-rose-50 text-rose-700">
            - {removed} 处{copy.diffLegend.removed}
          </span>
          <span className="chip border border-emerald-200 bg-emerald-50 text-emerald-700">
            + {added} 处{copy.diffLegend.added}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Segmented
            label="对比方式"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'inline', label: '行内对比' },
              { value: 'split', label: '双栏对照' },
              { value: 'revised', label },
            ]}
          />
          <CopyButton text={revised} label={`复制${label}`} />
        </div>
      </div>
      <div className="p-4 font-serif text-[15px] leading-relaxed whitespace-pre-wrap text-zinc-800">
        {mode === 'inline' && (
          <>
            <p className="mb-2 font-sans text-xs whitespace-normal text-zinc-400">{copy.diffLegend.note}</p>
            <Parts parts={parts} />
          </>
        )}
        {mode === 'split' && (
          <div className="space-y-3">
            {paragraphs.map((paragraph, index) => (
              <div key={index} className="grid grid-cols-2 gap-3 border-b border-zinc-100 pb-3 last:border-0">
                <div className="rounded-md bg-zinc-50 p-3">
                  <Parts parts={paragraph} hide="added" />
                </div>
                <div className="rounded-md border border-emerald-100 bg-emerald-50/40 p-3">
                  <Parts parts={paragraph} hide="removed" />
                </div>
              </div>
            ))}
          </div>
        )}
        {mode === 'revised' && revised}
      </div>
    </div>
  );
}
