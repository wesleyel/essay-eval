import { ESSAY_TYPES, LENGTH_UNIT, TYPE_SPECS, lengthStatus, type Essay, type LengthStatus, type UpdateEssayInput } from '@essay/domain';
import { AlertCircle, Check, ChevronDown, ChevronUp, FileImage, FileText, History, Loader2, RotateCcw, Sparkles, X } from 'lucide-react';
import { useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react';
import type { SaveStatus } from '../lib/autosave';
import { CONTENT_PLACEHOLDER, COPY } from '../lib/copy';
import { errorMessage } from '../lib/http';
import { compressImage } from '../lib/image';
import { cx, Segmented, useToast } from './ui';

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
  onOpenHistory: () => void;
  historyCount: number;
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

export function Editor({ ref, essay, onChange, saveStatus, onRetrySave, onGenerateTitle, titleBusy, canUndo, onUndo, onOpenHistory, historyCount }: Props) {
  const copy = COPY[essay.subject];
  const notify = useToast();
  const body = useRef<HTMLTextAreaElement>(null);
  const [showPrompt, setShowPrompt] = useState(true);
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
    <section id="draft" className="flex min-h-0 min-w-0 flex-col bg-white">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            label="题型"
            value={essay.type}
            onChange={(type) => onChange({ type })}
            options={ESSAY_TYPES[essay.subject].map((value) => ({ value, label: TYPE_SPECS[value].label }))}
          />
          <span className="hidden text-xs text-zinc-400 sm:inline">
            建议 {min}-{max} {unit}
          </span>
        </div>
        <button type="button" className="btn" onClick={onOpenHistory} title="历史作答记录与评分轨迹">
          <History className="text-accent" />
          历史记录
          {historyCount > 0 && <span className="chip border border-accent-soft bg-accent-wash text-accent-strong">{historyCount}</span>}
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
        <div className="flex items-center gap-2">
          <input
            value={essay.title}
            onChange={(event) => onChange({ title: event.target.value })}
            aria-label="标题"
            placeholder={copy.untitled}
            className="min-w-0 flex-1 border-b border-transparent bg-transparent py-1 text-xl font-bold text-zinc-900 outline-none placeholder:text-zinc-300 focus:border-accent"
          />
          <button type="button" className="btn shrink-0" onClick={onGenerateTitle} disabled={titleBusy}>
            {titleBusy ? <Loader2 className="animate-spin" /> : <Sparkles />}
            AI 生成标题
          </button>
        </div>

        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
          <button
            type="button"
            onClick={() => setShowPrompt((value) => !value)}
            aria-expanded={showPrompt}
            className="flex w-full items-center gap-2 border-b border-zinc-200 bg-zinc-100/70 px-3.5 py-2.5 text-left text-xs font-semibold text-zinc-700"
          >
            <FileText className="size-4 text-accent" />
            {copy.promptLabel}
            {showPrompt ? <ChevronUp className="size-4 text-zinc-400" /> : <ChevronDown className="size-4 text-zinc-400" />}
          </button>
          {showPrompt && (
            <div className="space-y-3 bg-white p-3">
              <textarea value={essay.prompt} onChange={(event) => onChange({ prompt: event.target.value })} rows={3} placeholder={copy.promptPlaceholder} className="field resize-y leading-relaxed" />
              <div className="flex items-center gap-2">
                <label className="btn cursor-pointer">
                  <FileImage />
                  添加题目图片
                  <input type="file" accept="image/*" className="hidden" onChange={(event) => void attachImage(event.target.files?.[0])} />
                </label>
                {essay.promptImage && (
                  <button type="button" className="btn" onClick={() => onChange({ promptImage: null })}>
                    <X />
                    移除图片
                  </button>
                )}
              </div>
              {essay.promptImage && <img src={essay.promptImage} alt="题目图片" className="max-h-64 max-w-full rounded-md border border-zinc-200 object-contain" />}
            </div>
          )}
        </div>

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
