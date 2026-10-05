import { SUBJECTS, type Subject } from '@essay/domain';
import { Download, Landmark, PanelLeftClose, PanelLeftOpen, PenLine, Settings } from 'lucide-react';
import { COPY } from '../lib/copy';
import { cx } from './ui';

const SUBJECT_ICON = { english: PenLine, politics: Landmark } satisfies Record<Subject, unknown>;

interface Props {
  subject: Subject;
  onSubject: (subject: Subject) => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onBackup: () => void;
  onSettings: () => void;
}

export function Header({ subject, onSubject, sidebarOpen, onToggleSidebar, onBackup, onSettings }: Props) {
  const copy = COPY[subject];
  return (
    <header className="z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-white px-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-4">
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={onToggleSidebar}
          aria-expanded={sidebarOpen}
          aria-controls="essay-list"
          aria-label={sidebarOpen ? '关闭列表侧栏' : '打开列表侧栏'}
        >
          {sidebarOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
        </button>

        <div role="tablist" aria-label="科目" className="flex rounded-lg border border-zinc-200 bg-zinc-100 p-0.5">
          {SUBJECTS.map((value) => {
            const Icon = SUBJECT_ICON[value];
            const selected = value === subject;
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={selected}
                data-subject={value}
                onClick={() => onSubject(value)}
                className={cx(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-colors',
                  selected ? 'bg-accent text-white shadow-sm' : 'text-zinc-600 hover:bg-white/60 hover:text-zinc-900',
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                {COPY[value].tab}
              </button>
            );
          })}
        </div>

        <div className="hidden min-w-0 items-center gap-2 border-l border-zinc-200 pl-3 sm:flex">
          <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-[11px] font-bold text-white">
            {copy.badge}
          </span>
          <div className="min-w-0 leading-tight">
            <h1 className="truncate text-xs font-bold text-zinc-900">{copy.heading}</h1>
            <p className="truncate text-[10px] text-zinc-500">{copy.tagline}</p>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button type="button" className="btn btn-ghost" onClick={onBackup} title="备份全部数据">
          <Download />
          <span className="hidden sm:inline">备份</span>
        </button>
        <button type="button" className="btn btn-ghost" onClick={onSettings} title="模型设置">
          <Settings />
          <span className="hidden sm:inline">设置</span>
        </button>
      </div>
    </header>
  );
}
