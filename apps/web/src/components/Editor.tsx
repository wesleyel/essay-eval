import { LENGTH_UNIT, TYPE_SPECS, lengthStatus, type Essay, type LengthStatus, type UpdateEssayInput } from '@essay/domain';
import { AlertCircle, Check, FileImage, Loader2, RotateCcw, Sparkles, X } from 'lucide-react';
import { useImperativeHandle, useRef, type ReactNode, type Ref } from 'react';
import type { SaveStatus } from '../lib/autosave';
import { CONTENT_PLACEHOLDER, COPY } from '../lib/copy';
import { errorMessage } from '../lib/http';
import { compressImage } from '../lib/image';
import { cx, useToast } from './ui';

export interface EditorHandle {
  /** 在正文中选中并滚动到指定文本 */
  locate(text: string): void;
}

interface Props {
  ref?: Ref<EditorHandle>;
  essay: Essay;
  onChange: (patch: UpdateEssayInput) => void;
  saveStatus: SaveStatus;
  onRetrySave: () => void;
  onGenerateTitle: () => void;
  titleBusy: boolean;
  canUndo: boolean;
  onUndo: () => void;
}

const SAVE_STATE: Record<SaveStatus, { label: string; icon: ReactNode; className: string }> = {
  saved: { label: '已保存', icon: <Check className="size-3.5" />, className: 'text-emerald-600' },
  saving: { label: '保存中', icon: <Loader2 className="size-3.5 animate-spin" />, className: 'text-zinc-500' },
  error: { label: '保存失败', icon: <AlertCircle className="size-3.5" />, className: 'text-rose-600' },
};

const LENGTH_TONE: Record<LengthStatus['kind'], { dot: string; text: string }> = {
  empty: { dot: 'bg-zinc-300', text: 'text-zinc-400' },
  short: { dot: 'bg-amber-500', text: 'text-amber-600' },
  ok: { dot: 'bg-emerald-500', text: 'text-emerald-600' },
  long: { dot: 'bg-rose-500', text: 'text-rose-600' },
};

function lengthLabel(status: LengthStatus, unit: string): string {
  switch (status.kind) {
    case 'empty':
      return '尚未动笔';
    case 'short':
      return `还需约 ${status.missing} ${unit}`;
    case 'ok':
      return '目标范围内';
    case 'long':
      return `超出约 ${status.excess} ${unit}`;
  }
}

export function Editor({ ref, essay, onChange, saveStatus, onRetrySave, onGenerateTitle, titleBusy, canUndo, onUndo }: Props) {
  const copy = COPY[essay.subject];
  const notify = useToast();
  const body = useRef<HTMLTextAreaElement>(null);
  const unit = LENGTH_UNIT[essay.subject];
  const { min, max } = TYPE_SPECS[essay.type].length;
  const status = lengthStatus(essay.wordCount, essay.type);
  const save = SAVE_STATE[saveStatus];

  useImperativeHandle(ref, () => ({
    locate(text) {
      const textarea = body.current;
      const start = text ? essay.content.indexOf(text) : -1;
      if (!textarea || start < 0) return;
      textarea.focus();
      textarea.setSelectionRange(start, start + text.length);
      const lineHeight = Number.parseFloat(getComputedStyle(textarea).lineHeight) || 32;
      textarea.scrollTop = Math.max(0, (essay.content.slice(0, start).split('\n').length - 3) * lineHeight);
    },
  }));

  async function attachImage(file: File | undefined) {
    if (!file) return;
    try {
      onChange({ promptImage: await compressImage(file) });
    } catch (error) {
      notify(errorMessage(error));
    }
  }

  return (
    <section id="draft" className="min-h-0 min-w-0 overflow-y-auto bg-white">
      <div className="flex min-h-full flex-col gap-3 px-6 py-4">
        <div className="flex items-center gap-2">
          <input
            value={essay.title}
            onChange={(event) => onChange({ title: event.target.value })}
            aria-label="标题"
            placeholder={copy.untitled}
            className="min-w-0 flex-1 border-b border-transparent bg-transparent py-1 text-xl font-bold text-zinc-900 outline-none placeholder:text-zinc-300 focus:border-accent"
          />
          <button type="button" className="btn btn-ghost shrink-0" onClick={onGenerateTitle} disabled={titleBusy} title="AI 生成标题">
            {titleBusy ? <Loader2 className="animate-spin" /> : <Sparkles />}
            AI 标题
          </button>
        </div>

        <div className="group relative">
          <textarea
            value={essay.prompt}
            onChange={(event) => onChange({ prompt: event.target.value })}
            rows={2}
            aria-label="题目要求"
            placeholder={copy.promptPlaceholder}
            className="block max-h-72 min-h-14 w-full resize-y rounded-md border border-transparent bg-zinc-50 py-2 pr-28 pl-3 text-sm leading-relaxed text-zinc-700 outline-none [field-sizing:content] placeholder:text-zinc-400 focus:border-accent focus:bg-white"
          />
          <div className="absolute top-1.5 right-1.5 flex gap-1">
            {essay.promptImage && (
              <button type="button" className="btn btn-ghost btn-icon size-7" title="移除题目图片" aria-label="移除题目图片" onClick={() => onChange({ promptImage: null })}>
                <X />
              </button>
            )}
            <label className="btn btn-ghost min-h-7 cursor-pointer px-2" title="添加题目图片">
              <FileImage />
              {essay.promptImage ? '换图' : '图片'}
              <input type="file" accept="image/*" className="hidden" onChange={(event) => void attachImage(event.target.files?.[0])} />
            </label>
          </div>
        </div>
        {essay.promptImage && <img src={essay.promptImage} alt="题目图片" className="max-h-64 max-w-full self-start rounded-md border border-zinc-200 object-contain" />}

        <div className="flex min-h-[360px] flex-1 flex-col rounded-lg border border-zinc-200 bg-white shadow-sm">
          <textarea
            ref={body}
            value={essay.content}
            onChange={(event) => onChange({ content: event.target.value })}
            placeholder={CONTENT_PLACEHOLDER[essay.type]}
            aria-label={copy.contentLabel}
            className="min-h-[300px] w-full flex-1 resize-none bg-transparent p-5 font-serif text-base leading-8 text-zinc-800 outline-none placeholder:text-zinc-300"
          />
          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-zinc-100 px-4 py-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-mono font-semibold text-zinc-800">{essay.wordCount}</span>
              <span className="text-zinc-400">
                / {min}-{max} {unit}
              </span>
              <span className={cx('flex items-center gap-1 font-medium', LENGTH_TONE[status.kind].text)}>
                <span className={cx('inline-block size-1.5 rounded-full', LENGTH_TONE[status.kind].dot)} />
                {lengthLabel(status, unit)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span role="status" className={cx('inline-flex items-center gap-1.5', save.className)}>
                {save.icon}
                {save.label}
                {saveStatus === 'error' && (
                  <button type="button" onClick={onRetrySave} className="font-semibold underline underline-offset-2">
                    重试
                  </button>
                )}
              </span>
              <button type="button" className="btn" onClick={onUndo} disabled={!canUndo} title="撤销最近一次替换或恢复">
                <RotateCcw />
                撤销
              </button>
            </div>
          </footer>
        </div>
      </div>
    </section>
  );
}
