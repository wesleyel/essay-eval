import { categoriesOf, defaultCategory, ESSAY_TYPES, MAX_TAG_LENGTH, MAX_TAGS, normalizeTags, TYPE_SPECS, type CreateEssayInput, type EssaySummary, type EssayType, type Subject } from '@essay/domain';
import { Loader2, Plus, X } from 'lucide-react';
import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { COPY } from '../lib/copy';
import { Dialog, Segmented } from './ui';

/** 主题标签输入：回车、逗号或失焦时添加；至少保留 min 个 */
export function TagInput({ tags, onChange, suggestions = [], min = 0 }: { tags: string[]; onChange: (tags: string[]) => void; suggestions?: string[]; min?: number }) {
  const [draft, setDraft] = useState('');
  const listId = useId();
  const full = tags.length >= MAX_TAGS;

  function commit(value = draft) {
    const next = normalizeTags([...tags, ...value.split(/[,，、]/)]).slice(0, MAX_TAGS);
    setDraft('');
    if (next.length !== tags.length) onChange(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',' || event.key === '，') {
      event.preventDefault();
      if (draft.trim()) commit();
    } else if (event.key === 'Backspace' && !draft && tags.length > min) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1 rounded-md border border-zinc-300 bg-white px-1.5 py-1 focus-within:border-accent">
      {tags.map((tag) => (
        <span key={tag} className="chip bg-accent-soft text-accent-strong">
          {tag}
          {tags.length > min && (
            <button type="button" className="rounded hover:bg-white/60" aria-label={`移除标签 ${tag}`} onClick={() => onChange(tags.filter((item) => item !== tag))}>
              <X className="size-3" />
            </button>
          )}
        </span>
      ))}
      <input
        value={draft}
        list={listId}
        maxLength={MAX_TAG_LENGTH}
        disabled={full}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => draft.trim() && commit()}
        placeholder={full ? `最多 ${MAX_TAGS} 个` : tags.length ? '添加主题' : '输入主题后回车，如：坚持'}
        className="h-6 min-w-24 flex-1 bg-transparent px-1 text-xs outline-none"
      />
      <datalist id={listId}>
        {suggestions.filter((item) => !tags.includes(item)).map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
    </div>
  );
}

/** 分类（该题型有分类时）+ 主题标签。分类与题型绑定，切换题型时由调用方重置 */
export function ClassificationFields({
  type,
  category,
  tags,
  suggestions,
  onCategory,
  onTags,
}: {
  type: EssayType;
  category: string;
  tags: string[];
  suggestions?: string[];
  onCategory: (category: string) => void;
  onTags: (tags: string[]) => void;
}) {
  const categories = categoriesOf(type);
  return (
    <>
      {categories.length > 0 && (
        <Segmented label="分类" value={category} onChange={onCategory} options={categories.map((value) => ({ value, label: value }))} />
      )}
      <TagInput tags={tags} onChange={onTags} suggestions={suggestions} min={1} />
    </>
  );
}

/** 已有作答里用过的主题标签，按使用次数排序，作为输入建议 */
export function useTagSuggestions(essays: Pick<EssaySummary, 'tags'>[]): string[] {
  return useMemo(() => {
    const counts = new Map<string, number>();
    for (const essay of essays) for (const tag of essay.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
  }, [essays]);
}

/** 新建作答：先声明题型、分类与主题标签 */
export function NewEssayDialog({
  subject,
  initialType,
  essays,
  pending,
  onCreate,
  onClose,
}: {
  subject: Subject;
  initialType?: EssayType;
  essays: EssaySummary[];
  pending: boolean;
  onCreate: (input: CreateEssayInput) => void;
  onClose: () => void;
}) {
  const copy = COPY[subject];
  const [type, setType] = useState<EssayType>(initialType ?? ESSAY_TYPES[subject][0]);
  const [category, setCategory] = useState(defaultCategory(type));
  const [tags, setTags] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const suggestions = useTagSuggestions(essays);

  function chooseType(next: EssayType) {
    setType(next);
    setCategory(defaultCategory(next));
  }

  function submit() {
    // subject 与 type 同属一个科目，由调用方保证
    onCreate({ subject, type, category, tags: normalizeTags(tags), title: title.trim() || undefined } as CreateEssayInput);
  }

  return (
    <Dialog title={copy.newEssay} subtitle="先声明题型、分类与主题标签，之后可在编辑区修改" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (tags.length) submit();
        }}
      >
        <Field label="题型">
          <Segmented label="题型" value={type} onChange={chooseType} options={ESSAY_TYPES[subject].map((value) => ({ value, label: TYPE_SPECS[value].label }))} />
        </Field>
        {categoriesOf(type).length > 0 && (
          <Field label="分类">
            <Segmented label="分类" value={category} onChange={setCategory} options={categoriesOf(type).map((value) => ({ value, label: value }))} />
          </Field>
        )}
        <Field label="主题标签" hint="作文表述的主题，可添加多个，如：坚持、环保">
          <TagInput tags={tags} onChange={setTags} suggestions={suggestions} min={0} />
        </Field>
        <Field label="标题（可选）">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={copy.untitled} maxLength={200} className="field" />
        </Field>
        <div className="flex justify-end gap-2 border-t border-zinc-200 pt-3">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending || !tags.length}>
            {pending ? <Loader2 className="animate-spin" /> : <Plus />}
            创建
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-bold text-zinc-700">{label}</span>
        {hint && <span className="text-[11px] text-zinc-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
