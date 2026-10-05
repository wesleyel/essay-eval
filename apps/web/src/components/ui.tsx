/** 通用界面原件：与业务无关 */
import { Check, Copy, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

// ---------- 分段选择 ----------

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cx('flex flex-wrap gap-0.5 rounded-md border border-zinc-200 bg-zinc-100 p-0.5', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={cx(
            'flex-1 rounded px-2 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors',
            option.value === value ? 'bg-white text-accent-strong shadow-sm' : 'text-zinc-500 hover:text-zinc-900',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// ---------- 对话框（原生 dialog：自带焦点约束与 Esc 关闭） ----------

export function Dialog({ title, subtitle, onClose, children, wide }: { title: string; subtitle?: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => event.target === ref.current && onClose()}
      aria-label={title}
      className={cx('m-auto max-h-[90vh] w-[calc(100%-24px)] overflow-hidden rounded-xl border border-zinc-200 bg-white p-0 shadow-2xl', wide ? 'max-w-6xl' : 'max-w-3xl')}
    >
      <div className="flex max-h-[90vh] flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-zinc-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
          </div>
          <button type="button" className="btn btn-ghost btn-icon" aria-label="关闭" onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </dialog>
  );
}

// ---------- 复制 ----------

export function CopyButton({ text, label = '复制', showLabel }: { text: string; label?: string; showLabel?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 剪贴板不可用时静默失败 */
    }
  }
  return (
    <button type="button" className={cx('btn', !showLabel && 'btn-icon btn-ghost')} title={label} aria-label={label} onClick={() => void copy()}>
      {copied ? <Check className="text-emerald-600" /> : <Copy />}
      {showLabel && (copied ? '已复制' : label)}
    </button>
  );
}

// ---------- 通知 ----------

const ToastContext = createContext<(message: string) => void>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const notify = useCallback((next: string) => {
    setMessage(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(''), 4500);
  }, []);
  return (
    <ToastContext value={notify}>
      {children}
      {message && (
        <div role="status" className="fixed right-4 bottom-4 z-50 flex max-w-[min(400px,calc(100vw-32px))] items-center gap-3 rounded-md border border-zinc-600 bg-zinc-800 py-2.5 pr-2 pl-4 text-xs text-white shadow-lg">
          <span>{message}</span>
          <button type="button" className="rounded p-1 text-zinc-300 hover:text-white" aria-label="关闭通知" onClick={() => setMessage('')}>
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </ToastContext>
  );
}

// ---------- 分区 ----------

export function Section({ id, icon, title, action, children }: { id: string; icon?: ReactNode; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-3 border-b border-zinc-200 px-4 py-4 sm:px-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[13px] font-extrabold text-zinc-700 [&_svg]:size-4 [&_svg]:text-accent">
          {icon}
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-zinc-300 bg-white px-3 py-6 text-center text-xs text-zinc-500 [&_svg]:mx-auto [&_svg]:mb-2 [&_svg]:size-5 [&_svg]:text-accent">
      {icon}
      {children}
    </div>
  );
}

export const formatDate = (iso: string, options?: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString(undefined, options);
