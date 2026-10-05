import type { Template } from '@essay/domain';
import { Trash2 } from 'lucide-react';
import { CopyButton } from './ui';

/** 语料卡片：评阅面板与语料库共用 */
export function TemplateCard({ template, onDelete }: { template: Template; onDelete?: () => void }) {
  return (
    <article className="min-w-0 rounded-md border border-zinc-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="chip bg-accent-soft text-accent-strong">{template.category}</span>
        <div className="flex">
          <CopyButton text={template.pattern} label="复制模板" />
          {onDelete && (
            <button type="button" className="btn btn-ghost btn-icon" title="删除" aria-label="删除" onClick={onDelete}>
              <Trash2 />
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 mb-1.5 font-serif text-sm leading-relaxed text-zinc-900">{template.pattern}</p>
      {template.usage && <p className="text-[11px] leading-relaxed text-zinc-500">{template.usage}</p>}
      {template.example && <p className="mt-2 border-l-2 border-accent bg-zinc-50 p-2 text-[11px] leading-relaxed text-zinc-600">例：{template.example}</p>}
      {template.source && <p className="mt-2 text-[10px] text-zinc-400">来源：{template.source.title}</p>}
    </article>
  );
}
