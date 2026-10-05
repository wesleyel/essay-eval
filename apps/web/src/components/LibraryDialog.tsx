import type { EssaySummary, Subject } from '@essay/domain';
import { BookMarked, Loader2, RefreshCw, Search } from 'lucide-react';
import { useState } from 'react';
import { useTemplateLibrary } from '../hooks/library';
import { COPY } from '../lib/copy';
import { errorMessage } from '../lib/http';
import { TemplateCard } from './TemplateCard';
import { cx, Dialog, useToast } from './ui';

const ALL = '全部';

export function LibraryDialog({ subject, essays, onClose }: { subject: Subject; essays: EssaySummary[]; onClose: () => void }) {
  const copy = COPY[subject].library;
  const notify = useToast();
  const { templates, extract, remove } = useTemplateLibrary(subject);
  const [scope, setScope] = useState('');
  const [category, setCategory] = useState(ALL);
  const [search, setSearch] = useState('');
  const answered = essays.filter((essay) => essay.content.trim());

  const items = templates.data ?? [];
  const categories = [ALL, ...new Set(items.map((item) => item.category))];
  const needle = search.trim().toLowerCase();
  const visible = items.filter(
    (item) => (category === ALL || item.category === category) && (!needle || `${item.pattern} ${item.usage} ${item.example}`.toLowerCase().includes(needle)),
  );

  async function runExtract() {
    try {
      const added = await extract.mutateAsync(scope || undefined);
      notify(added.length ? `已新增 ${added.length} 条${copy.noun}` : `本次没有发现新的${copy.noun}`);
    } catch (error) {
      notify(errorMessage(error));
    }
  }

  return (
    <Dialog title={copy.title} subtitle={copy.description} onClose={onClose} wide>
      <div className="flex flex-wrap items-center gap-2.5 border-b border-zinc-200 pb-4 text-xs">
        <label className="flex items-center gap-2 text-zinc-500">
          提取范围
          <select value={scope} onChange={(event) => setScope(event.target.value)} className="field h-8 w-auto py-0 text-xs">
            <option value="">{copy.scopeAll}</option>
            {answered.map((essay) => (
              <option key={essay.id} value={essay.id}>
                {essay.title}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn-primary" disabled={extract.isPending || !answered.length} onClick={() => void runExtract()}>
          {extract.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          {copy.extract}
        </button>
        <label className="relative ml-auto">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-zinc-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索句式、用途或例句" className="field h-8 w-56 py-0 pl-8 text-xs" />
        </label>
      </div>

      <div className="flex flex-wrap gap-1 py-3">
        {categories.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            className={cx('rounded px-2.5 py-1 text-xs', item === category ? 'bg-accent-soft text-accent-strong' : 'text-zinc-500 hover:bg-zinc-100')}
          >
            {item}
          </button>
        ))}
      </div>

      {templates.error && <p className="notice mb-3 border border-rose-200 bg-rose-50 text-rose-700">{errorMessage(templates.error)}</p>}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
        {visible.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onDelete={() => remove.mutate(template.id, { onError: (error) => notify(errorMessage(error)) })}
          />
        ))}
        {!visible.length && !templates.isPending && (
          <div className="col-span-full grid justify-items-center gap-2 py-16 text-xs text-zinc-500">
            <BookMarked className="size-7 text-accent" />
            {items.length ? '没有匹配的条目' : copy.empty}
          </div>
        )}
      </div>
    </Dialog>
  );
}
