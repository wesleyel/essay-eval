import { ESSAY_TYPES, LENGTH_UNIT, SUBJECTS, TYPE_SPECS, type EssaySummary, type EssayType, type Subject } from '@essay/domain';
import { CheckCircle2, Download, Landmark, PanelLeftClose, PenLine, Plus, Search, Settings, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { COPY } from '../lib/copy';
import { cx, formatDate, Segmented } from './ui';

type TypeFilter = EssayType | 'all';
type ProgressFilter = 'all' | 'answered' | 'blank';

const SUBJECT_ICON = { english: PenLine, politics: Landmark } satisfies Record<Subject, unknown>;

interface Props {
  subject: Subject;
  onSubject: (subject: Subject) => void;
  onBackup: () => void;
  onSettings: () => void;
  essays: EssaySummary[];
  currentId: string | null;
  open: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onCreate: (type?: EssayType) => void;
  onDelete: (essay: EssaySummary) => void;
}

const isAnswered = (essay: EssaySummary) => essay.content.trim().length > 0;

export function Sidebar({ subject, onSubject, onBackup, onSettings, essays, currentId, open, onClose, onSelect, onCreate, onDelete }: Props) {
  const copy = COPY[subject];
  const [type, setType] = useState<TypeFilter>('all');
  const [progress, setProgress] = useState<ProgressFilter>('all');
  const [search, setSearch] = useState('');

  useEffect(() => setType('all'), [subject]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const answered = essays.filter(isAnswered).length;
  const needle = search.trim().toLowerCase();
  const visible = essays.filter(
    (essay) =>
      (type === 'all' || essay.type === type) &&
      (progress === 'all' || (progress === 'answered') === isAnswered(essay)) &&
      (!needle || [essay.title, essay.content, essay.prompt].some((text) => text.toLowerCase().includes(needle))),
  );

  return (
    <>
      <button type="button" aria-label="关闭列表" onClick={onClose} className="fixed inset-0 z-30 cursor-default bg-zinc-950/20 xl:hidden" />
      <aside id="essay-list" aria-label={copy.list} className="fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-zinc-200 bg-white xl:static xl:z-auto xl:w-64">
        <div className="shrink-0 space-y-2 border-b border-zinc-200 p-3">
          <div className="flex items-center gap-2">
            <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-[11px] font-bold text-white">
              {copy.badge}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <h1 className="truncate text-xs font-bold text-zinc-900">{copy.heading}</h1>
              <p className="truncate text-[10px] text-zinc-500">{copy.tagline}</p>
            </div>
            <button type="button" className="btn btn-ghost btn-icon shrink-0" aria-label="收起侧栏" title="收起侧栏" onClick={onClose}>
              <PanelLeftClose />
            </button>
          </div>
          <SubjectTabs subject={subject} onSubject={onSubject} />
          <button type="button" className="btn btn-primary w-full" onClick={() => onCreate(type === 'all' ? undefined : type)}>
            <Plus />
            {copy.newEssay}
          </button>
          <label className="relative block">
            <span className="sr-only">搜索</span>
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-zinc-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy.searchPlaceholder} className="field h-8 py-0 pl-8 text-xs" />
          </label>
          <Segmented
            label="题型筛选"
            value={type}
            onChange={setType}
            options={[{ value: 'all', label: '全部' }, ...ESSAY_TYPES[subject].map((value) => ({ value, label: TYPE_SPECS[value].shortLabel }))]}
          />
          <Segmented
            label="作答进度筛选"
            value={progress}
            onChange={setProgress}
            options={[
              { value: 'all', label: '全部进度' },
              { value: 'answered', label: `已答(${answered})` },
              { value: 'blank', label: `待答(${essays.length - answered})` },
            ]}
          />
        </div>

        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {visible.length === 0 && <li className="px-2 py-8 text-center text-xs text-zinc-400">{needle ? '无匹配结果' : copy.emptyList}</li>}
          {visible.map((essay) => (
            <EssayItem key={essay.id} essay={essay} active={essay.id === currentId} onSelect={() => onSelect(essay.id)} onDelete={() => onDelete(essay)} />
          ))}
        </ul>

        <footer className="flex shrink-0 gap-1 border-t border-zinc-200 p-2">
          <button type="button" className="btn btn-ghost flex-1" onClick={onBackup} title="备份全部数据">
            <Download />
            备份
          </button>
          <button type="button" className="btn btn-ghost flex-1" onClick={onSettings} title="模型设置">
            <Settings />
            设置
          </button>
        </footer>
      </aside>
    </>
  );
}

function SubjectTabs({ subject, onSubject }: { subject: Subject; onSubject: (subject: Subject) => void }) {
  return (
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
              'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-bold transition-colors',
              selected ? 'bg-accent text-white shadow-sm' : 'text-zinc-600 hover:bg-white/60 hover:text-zinc-900',
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {COPY[value].tab}
          </button>
        );
      })}
    </div>
  );
}

function EssayItem({ essay, active, onSelect, onDelete }: { essay: EssaySummary; active: boolean; onSelect: () => void; onDelete: () => void }) {
  const copy = COPY[essay.subject];
  const answered = isAnswered(essay);
  const preview = answered ? essay.content.trim().slice(0, 72) : essay.prompt ? `材料要求：${essay.prompt.replace(/\s+/g, ' ').slice(0, 60)}` : '尚未作答 · 点击开始编写';
  const latest = essay.latestEvaluation;

  return (
    <li
      className={cx(
        'group relative rounded-md border px-2.5 py-2 transition-colors',
        active ? 'border-accent bg-accent-wash ring-1 ring-accent' : answered ? 'border-zinc-200 bg-white hover:bg-zinc-50' : 'border-zinc-300 bg-zinc-50 hover:bg-zinc-100',
      )}
    >
      <button type="button" onClick={onSelect} className="block w-full pr-6 text-left">
        <div className="mb-1 flex items-center justify-between gap-1">
          <span className="chip border border-accent-soft bg-accent-wash text-accent-strong">{TYPE_SPECS[essay.type].shortLabel}</span>
          {latest ? (
            <span className="chip text-emerald-700">
              <CheckCircle2 className="size-3" />
              {latest.score}/{latest.maxScore}
              {essay.evaluationCount > 1 && <span className="rounded bg-emerald-100 px-1 text-emerald-900">{essay.evaluationCount}次</span>}
            </span>
          ) : (
            <span className={cx('chip', answered ? 'bg-accent-wash text-accent-strong' : 'bg-zinc-100 text-zinc-500')}>{answered ? '已动笔' : '待作答'}</span>
          )}
        </div>
        <h3 className={cx('truncate text-xs font-semibold', active ? 'text-accent-strong' : 'text-zinc-800')}>{essay.title || copy.untitled}</h3>
        <p className="mt-0.5 truncate text-[10px] text-zinc-500">{preview}</p>
        <p className="mt-1 flex gap-2 text-[10px] text-zinc-400">
          <span>{answered ? `${essay.wordCount} ${LENGTH_UNIT[essay.subject]}` : '待编写'}</span>
          <span aria-hidden>·</span>
          <time dateTime={essay.updatedAt}>{formatDate(essay.updatedAt, { dateStyle: 'short' })}</time>
        </p>
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="absolute top-1.5 right-1.5 rounded p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
        aria-label={`删除${essay.title || '此篇'}`}
        title="删除此篇"
      >
        <Trash2 className="size-3.5" />
      </button>
    </li>
  );
}
