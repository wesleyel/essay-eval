import { isSubject, SUBJECTS, TEMPLATE_CATEGORIES, type Subject, type Template } from '@essay/domain';
import { ArrowLeft, BookMarked, BookmarkPlus, ChevronDown, ChevronUp, Copy, Loader2, RefreshCw, Search, SearchX, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useEssayList } from '../hooks/essays';
import { useTemplateLibrary } from '../hooks/library';
import { useLocalState } from '../hooks/local-state';
import { COPY } from '../lib/copy';
import { errorMessage } from '../lib/http';
import { groupOf, highlight, isSavedCombos, patternSegments, positionOf, POSITIONS, UNGROUPED, type SavedCombo, type Segment } from '../lib/library';
import { Providers } from './Providers';
import { cx, Segmented, useToast } from './ui';

const ALL = '全部';
const byUngroupedLast = (a: string, b: string) => Number(a === UNGROUPED) - Number(b === UNGROUPED) || a.localeCompare(b, 'zh-CN');
const TAB_LABEL: Record<Subject, string> = { english: COPY.english.tab, politics: COPY.politics.tab };

export function LibraryPage() {
  return (
    <Providers>
      <Library />
    </Providers>
  );
}

function initialSubject(): Subject | null {
  const value = new URLSearchParams(location.search).get('subject');
  return isSubject(value) ? value : null;
}

function Library() {
  const [stored, setSubject] = useLocalState<Subject>('essay-eval:subject', 'english', isSubject);
  const [subject, setLocal] = useState<Subject>(() => initialSubject() ?? stored);
  const switchSubject = (next: Subject) => {
    setLocal(next);
    setSubject(next);
    history.replaceState(null, '', `?subject=${next}`);
  };
  useEffect(() => {
    document.documentElement.dataset.subject = subject;
    document.title = `${COPY[subject].library.title} · EssayPilot`;
  }, [subject]);

  // 切换科目时整体重建，避免筛选与组合稿串科目
  return <LibraryBody key={subject} subject={subject} onSubject={switchSubject} />;
}

const toggleId = (ids: string[], id: string) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);

function LibraryBody({ subject, onSubject }: { subject: Subject; onSubject: (subject: Subject) => void }) {
  const copy = COPY[subject].library;
  const notify = useToast();
  const { templates, extract, remove } = useTemplateLibrary(subject);
  const essays = useEssayList(subject).data ?? [];
  const answered = essays.filter((essay) => essay.content.trim());
  const items = templates.data ?? [];
  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const [scope, setScope] = useState('');
  const [search, setSearch] = useState('');
  const [essayGroup, setEssayGroup] = useState(ALL);
  const [essayTag, setEssayTag] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [basket, setBasket] = useState<string[]>([]);
  const [saveName, setSaveName] = useState('');
  const [saved, setSaved] = useLocalState<SavedCombo[]>(`essay-eval:combos:${subject}`, [], isSavedCombos);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const needle = search.trim().toLowerCase();
  const matched = items.filter((item) => !needle || `${item.pattern} ${item.usage} ${item.example} ${item.source?.title ?? ''}`.toLowerCase().includes(needle));

  // 两级筛选：作文分类（来源作答的分类）→ 主题标签（来源作答的主题）
  const groupNames = [...new Set(matched.map((item) => groupOf(item.source)))].sort(byUngroupedLast);
  const inGroup = matched.filter((item) => essayGroup === ALL || groupOf(item.source) === essayGroup);
  const tagCounts = new Map<string, number>();
  for (const item of inGroup) for (const name of item.source?.tags ?? []) tagCounts.set(name, (tagCounts.get(name) ?? 0) + 1);
  const tagNames = [...tagCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN')).map(([name]) => name);
  const byTag = inGroup.filter((item) => essayTag === ALL || item.source?.tags.includes(essayTag));

  // 句型类别（开头破题、原因分析…）在两级筛选之内再细分
  const sentenceCategories = [ALL, ...new Set([...TEMPLATE_CATEGORIES[subject], ...byTag.map((item) => item.category)])];
  const shown = byTag.filter((item) => category === ALL || item.category === category);
  const countSentence = (name: string) => (name === ALL ? byTag.length : byTag.filter((item) => item.category === name).length);
  const groups = sentenceCategories
    .filter((name) => name !== ALL)
    .map((name) => ({ name, items: shown.filter((item) => item.category === name) }))
    .filter((entry) => entry.items.length);

  function pickGroup(next: string) {
    setEssayGroup(next);
    setEssayTag(ALL);
  }

  const basketItems = basket.map((id) => byId.get(id)).filter((item): item is Template => Boolean(item));
  const sections = POSITIONS.map((position) => ({ ...position, items: basketItems.filter((item) => positionOf(item) === position.name) }));
  const fullText = sections
    .map((section) => section.items.map((item) => item.pattern).join(' '))
    .filter(Boolean)
    .join('\n\n');

  function move(id: string, delta: number) {
    const item = byId.get(id);
    if (!item) return;
    setBasket((ids) => {
      const same = ids.filter((other) => byId.get(other) && positionOf(byId.get(other)!) === positionOf(item));
      const target = same[same.indexOf(id) + delta];
      if (!target) return ids;
      const next = [...ids];
      const [i, j] = [ids.indexOf(id), ids.indexOf(target)];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify('已复制');
    } catch {
      notify('复制失败，请手动选择文本');
    }
  }

  async function runExtract() {
    try {
      const added = await extract.mutateAsync(scope || undefined);
      notify(added.length ? `已新增 ${added.length} 条${copy.noun}` : `本次没有发现新的${copy.noun}`);
    } catch (error) {
      notify(errorMessage(error));
    }
  }

  function saveCombo() {
    if (!basket.length) return;
    const name = saveName.trim() || `未命名组合 ${saved.length + 1}`;
    setSaved([{ id: crypto.randomUUID(), name, templateIds: [...basket], savedAt: new Date().toISOString() }, ...saved]);
    setSaveName('');
    notify(`已保存“${name}”`);
  }

  function removeTemplate(id: string) {
    remove.mutate(id, { onError: (error) => notify(errorMessage(error)) });
    setBasket((ids) => ids.filter((item) => item !== id));
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-zinc-200 bg-white px-4 py-2">
        <div className="flex min-w-0 items-center gap-3.5">
          <a className="btn" href={import.meta.env.BASE_URL}>
            <ArrowLeft />
            写作工作台
          </a>
          <div className="flex min-w-0 items-center gap-2 border-l border-zinc-200 pl-3.5">
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-accent text-[11px] font-bold text-white">{COPY[subject].badge}</span>
            <div className="min-w-0 leading-tight">
              <h1 className="truncate text-xs font-bold text-zinc-900">{copy.title}</h1>
              <p className="truncate text-[10px] text-zinc-500">搜索 · 聚合同类表达 · 组合成文</p>
            </div>
          </div>
          <Segmented
            label="科目"
            value={subject}
            onChange={onSubject}
            options={SUBJECTS.map((value) => ({ value, label: TAB_LABEL[value] }))}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-zinc-500">共 {items.length} 条{copy.noun}</span>
          <label className="flex items-center gap-1.5 text-xs text-zinc-500">
            范围
            <select value={scope} onChange={(event) => setScope(event.target.value)} className="field h-8 w-auto max-w-44 py-0 text-xs">
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
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(168px,224px)_minmax(0,1fr)_minmax(260px,340px)]">
        {/* 类别 + 我的组合 */}
        <aside className="hidden min-h-0 flex-col gap-5 overflow-y-auto border-r border-zinc-200 bg-white px-3 py-4 lg:flex">
          <div className="flex flex-col gap-0.5">
            <RailTitle>作文分类</RailTitle>
            <RailItem active={essayGroup === ALL} count={matched.length} onClick={() => pickGroup(ALL)}>
              {ALL}
            </RailItem>
            {groupNames.map((name) => (
              <div key={name} className="flex flex-col gap-0.5">
                <RailItem active={essayGroup === name} count={matched.filter((item) => groupOf(item.source) === name).length} onClick={() => pickGroup(name)}>
                  {name}
                </RailItem>
                {essayGroup === name && (
                  <div className="ml-3 flex flex-col gap-0.5 border-l border-zinc-200 pl-1.5">
                    <RailItem small active={essayTag === ALL} count={inGroup.length} onClick={() => setEssayTag(ALL)}>
                      全部主题
                    </RailItem>
                    {tagNames.map((tagName) => (
                      <RailItem small key={tagName} active={essayTag === tagName} count={tagCounts.get(tagName) ?? 0} onClick={() => setEssayTag(tagName)}>
                        {tagName}
                      </RailItem>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-auto flex flex-col gap-1 border-t border-zinc-200 pt-3.5">
            <RailTitle>我的组合</RailTitle>
            {saved.map((combo) => (
              <div key={combo.id} className="group flex items-center rounded hover:bg-zinc-100">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 flex-col items-start gap-0.5 px-2 py-1.5 text-left"
                  onClick={() => {
                    setBasket(combo.templateIds.filter((id) => byId.has(id)));
                    notify(`已载入“${combo.name}”`);
                  }}
                >
                  <span className="max-w-full truncate text-xs font-bold text-zinc-700">{combo.name}</span>
                  <span className="text-[11px] text-zinc-400">
                    {combo.templateIds.length} 句 · {new Date(combo.savedAt).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
                  </span>
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-icon opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  title="删除组合"
                  aria-label="删除组合"
                  onClick={() => setSaved(saved.filter((item) => item.id !== combo.id))}
                >
                  <X />
                </button>
              </div>
            ))}
            {!saved.length && <p className="px-2 text-[11px] leading-relaxed text-zinc-400">在右侧组合稿里点“保存组合”，下次可直接载入。</p>}
          </div>
        </aside>

        {/* 搜索 + 结果 */}
        <main className="flex min-h-0 min-w-0 flex-col bg-zinc-100">
          <div className="flex flex-col gap-3 bg-white px-5 pt-4 pb-3">
            <label className="flex h-11 items-center gap-2.5 rounded-lg border border-zinc-300 px-3.5 text-zinc-500 focus-within:border-accent">
              <Search className="size-4.5 shrink-0" />
              <input
                ref={searchRef}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索句型、用途或例句，如 contribute to / 原因 / [reason]"
                className="h-full min-w-0 flex-1 bg-transparent text-sm text-zinc-800 outline-none"
              />
              {search && (
                <button type="button" className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-bold text-zinc-600" onClick={() => setSearch('')}>
                  清除
                </button>
              )}
              <kbd className="rounded border border-zinc-200 px-1.5 font-mono text-[11px] text-zinc-400">/</kbd>
            </label>
          </div>

          <div className="flex flex-col gap-2 border-b border-zinc-200 bg-white px-5 pb-3">
            <ChipRow label="作文分类" values={[ALL, ...groupNames]} value={essayGroup} onPick={pickGroup} className="lg:hidden" />
            {essayGroup !== ALL && <ChipRow label="主题" values={[ALL, ...tagNames]} value={essayTag} onPick={setEssayTag} className="lg:hidden" />}
            <ChipRow label="句型" values={sentenceCategories} value={category} onPick={setCategory} counts={countSentence} />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-10">
            {templates.error && <p className="notice mb-3 border border-rose-200 bg-rose-50 text-rose-700">{errorMessage(templates.error)}</p>}
            {groups.map((group) => (
              <section key={group.name} id={`g-${group.name}`} className="mb-7 flex scroll-mt-2 flex-col gap-2.5">
                <div className="flex items-baseline gap-2.5 border-b border-zinc-200 pb-2">
                  <h2 className="text-[15px] font-extrabold whitespace-nowrap text-zinc-900">{group.name}</h2>
                  <span className="text-[11px] text-zinc-500">{group.items.length} 条</span>
                  <span className="flex-1" />
                  {category === ALL && (
                    <button type="button" className="text-[11px] font-bold whitespace-nowrap text-accent" onClick={() => setCategory(group.name)}>
                      只看此类
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-[11px] font-bold whitespace-nowrap text-zinc-600 hover:text-accent"
                    onClick={() => setBasket((ids) => [...ids, ...group.items.map((item) => item.id).filter((id) => !ids.includes(id))])}
                  >
                    全部加入
                  </button>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-2.5">
                  {group.items.map((item) => (
                    <CorpusCard
                      key={item.id}
                      template={item}
                      needle={needle}
                      added={basket.includes(item.id)}
                      onToggle={() => setBasket((ids) => toggleId(ids, item.id))}
                      onCopy={() => void copyText(item.pattern)}
                      onDelete={() => removeTemplate(item.id)}
                    />
                  ))}
                </div>
              </section>
            ))}
            {templates.isPending ? (
              <div className="grid justify-items-center py-16">
                <Loader2 className="size-6 animate-spin text-accent" />
              </div>
            ) : (
              !groups.length && (
                <div className="grid justify-items-center gap-2 px-5 py-16 text-center text-[13px] text-zinc-500">
                  {items.length ? <SearchX className="size-7 text-accent" /> : <BookMarked className="size-7 text-accent" />}
                  <p>{items.length ? `没有匹配${needle ? `“${search.trim()}”` : ''}的${copy.noun}。试试换个关键词，或清除分类、主题与句型筛选。` : copy.empty}</p>
                </div>
              )
            )}
          </div>
        </main>

        {/* 组合稿 */}
        <aside className="hidden min-h-0 flex-col border-l border-zinc-200 bg-zinc-50 lg:flex">
          <div className="flex min-h-16 items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4.5 py-3">
            <div>
              <span className="text-[10px] font-extrabold tracking-[0.12em] text-accent">DRAFT</span>
              <h2 className="text-base leading-tight font-bold text-zinc-900">组合稿</h2>
            </div>
            <span className="text-[11px] text-zinc-500">{basketItems.length} 句</span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-4.5 overflow-y-auto px-4.5 py-3.5">
            {sections.map((section) => (
              <div key={section.name} className="flex flex-col gap-2">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-[13px] font-extrabold text-zinc-700">{section.name}</h3>
                  <span className="text-[11px] text-zinc-400">{section.hint}</span>
                </div>
                {section.items.map((item) => (
                  <div key={item.id} className="flex gap-2 rounded-md border border-zinc-200 bg-white p-2.5">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-[10px] font-bold text-accent-strong">{item.category}</span>
                      <Pattern segments={patternSegments(item.pattern)} size="sm" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <MiniButton title="上移" onClick={() => move(item.id, -1)}>
                        <ChevronUp />
                      </MiniButton>
                      <MiniButton title="下移" onClick={() => move(item.id, 1)}>
                        <ChevronDown />
                      </MiniButton>
                      <MiniButton title="移除" danger onClick={() => setBasket((ids) => ids.filter((id) => id !== item.id))}>
                        <X />
                      </MiniButton>
                    </div>
                  </div>
                ))}
                {!section.items.length && <p className="rounded-md border border-dashed border-zinc-300 p-3 text-center text-[11px] text-zinc-400">从左侧加入{section.name}句型</p>}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 border-t border-zinc-200 bg-white px-4.5 pt-3 pb-4">
            <input value={saveName} onChange={(event) => setSaveName(event.target.value)} placeholder="组合名称，如：图画作文 · 坚持" className="field h-8 py-0 text-xs" />
            <div className="flex gap-2">
              <button type="button" className="btn flex-1" disabled={!basket.length} onClick={() => void copyText(fullText)}>
                <Copy />
                复制全文
              </button>
              <button type="button" className="btn btn-primary flex-1" disabled={!basket.length} onClick={saveCombo}>
                <BookmarkPlus />
                保存组合
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function RailItem({ active, count, small, onClick, children }: { active: boolean; count: number; small?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'flex items-center justify-between gap-2 rounded px-2 py-1.5 text-left',
        small ? 'text-[11px]' : 'text-xs',
        active ? 'bg-accent-soft font-bold text-accent-strong' : 'text-zinc-700 hover:bg-accent-wash',
      )}
    >
      <span className="truncate">{children}</span>
      <span className="text-[11px] text-zinc-400 tabular-nums">{count}</span>
    </button>
  );
}

function ChipRow({ label, values, value, onPick, counts, className }: { label: string; values: string[]; value: string; onPick: (value: string) => void; counts?: (value: string) => number; className?: string }) {
  return (
    <div className={cx('flex flex-wrap items-center gap-1', className)}>
      <span className="mr-1 text-[11px] text-zinc-400">{label}</span>
      {values.map((name) => {
        const total = counts?.(name);
        return (
          <button
            key={name}
            type="button"
            aria-pressed={name === value}
            onClick={() => onPick(name)}
            className={cx('rounded px-2 py-0.5 text-xs', name === value ? 'bg-accent-soft font-bold text-accent-strong' : 'text-zinc-500 hover:bg-zinc-100', total === 0 && name !== ALL && 'opacity-45')}
          >
            {name}
            {total !== undefined && <span className="ml-1 text-[11px] text-zinc-400 tabular-nums">{total}</span>}
          </button>
        );
      })}
    </div>
  );
}

function RailTitle({ children }: { children: string }) {
  return <span className="px-2 pb-1.5 text-[10px] font-extrabold tracking-[0.12em] text-accent">{children}</span>;
}

function MiniButton({ title, danger, onClick, children }: { title: string; danger?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cx('grid size-5.5 place-items-center rounded text-zinc-400 [&_svg]:size-3.5', danger ? 'hover:bg-rose-50 hover:text-rose-700' : 'hover:bg-zinc-100 hover:text-zinc-800')}
    >
      {children}
    </button>
  );
}

function Pattern({ segments, size }: { segments: Segment[]; size: 'sm' | 'md' }) {
  return (
    <p className={cx('font-serif leading-relaxed text-zinc-800', size === 'md' ? 'text-[15px]' : 'text-[13px]')}>
      {segments.map((segment, index) =>
        segment.kind === 'slot' ? (
          <span key={index} className="rounded-sm bg-accent-wash px-0.5 font-mono text-[0.85em] text-accent">
            {segment.text}
          </span>
        ) : segment.kind === 'hit' ? (
          <mark key={index} className="rounded-sm bg-yellow-200 px-px text-inherit">
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </p>
  );
}

function Marked({ text, needle }: { text: string; needle: string }) {
  return (
    <>
      {highlight(text, needle).map((segment, index) =>
        segment.kind === 'hit' ? (
          <mark key={index} className="rounded-sm bg-yellow-200 px-px text-inherit">
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}

function CorpusCard({ template, needle, added, onToggle, onCopy, onDelete }: { template: Template; needle: string; added: boolean; onToggle: () => void; onCopy: () => void; onDelete: () => void }) {
  return (
    <article className={cx('flex min-w-0 flex-col gap-2.5 rounded-[7px] border bg-white p-3.5', added ? 'border-accent-soft' : 'border-zinc-200')}>
      <div className="flex items-center gap-1.5">
        <span className="chip bg-accent-soft text-accent-strong">{template.category}</span>
        <span className="flex-1" />
        <button type="button" className="btn btn-ghost btn-icon" title="复制句型" aria-label="复制句型" onClick={onCopy}>
          <Copy />
        </button>
        <button type="button" className="btn btn-ghost btn-icon" title="删除" aria-label="删除" onClick={onDelete}>
          <Trash2 />
        </button>
        <button type="button" aria-pressed={added} className={cx('btn', added && 'border-accent-soft bg-accent-wash text-accent-strong')} onClick={onToggle}>
          {added ? '已加入' : '+ 加入'}
        </button>
      </div>
      <Pattern segments={patternSegments(template.pattern, needle)} size="md" />
      {template.usage && (
        <p className="text-xs leading-relaxed text-zinc-500">
          <Marked text={template.usage} needle={needle} />
        </p>
      )}
      {template.example && (
        <div className="rounded-[5px] bg-zinc-50 p-2.5 text-xs leading-relaxed text-zinc-600">
          <strong className="mb-0.5 block text-[11px] text-accent-strong">原文例句{template.source ? ` · ${template.source.title}` : ''}</strong>
          <Marked text={template.example} needle={needle} />
        </div>
      )}
    </article>
  );
}
