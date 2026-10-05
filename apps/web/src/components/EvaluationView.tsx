import { CORRECTION_LABELS, DIMENSION_KEYS, DIMENSIONS, LENGTH_UNIT, countWords, type Essay, type Evaluation } from '@essay/domain';
import { AlertTriangle, Check, CheckCircle2, Clock, MapPin, Replace, RotateCcw, Star, Trash2, TrendingUp } from 'lucide-react';
import { COPY } from '../lib/copy';
import { cx, formatDate } from './ui';

export interface TextActions {
  onLocate: (text: string) => void;
  onReplace: (original: string, replacement: string) => void;
}

interface Props extends TextActions {
  essay: Essay;
  evaluation: Evaluation;
  /** 新的在前 */
  evaluations: Evaluation[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRestore: (content: string) => void;
}

const percent = (score: number, max: number) => (max ? Math.round((score / max) * 100) : 0);

/** 最新一次相对第一次的分数变化 */
export function scoreDelta(evaluations: Evaluation[]): number {
  const latest = evaluations[0];
  const first = evaluations.at(-1);
  return latest && first ? latest.score - first.score : 0;
}

export function EvaluationView({ essay, evaluation, evaluations, onSelect, onDelete, onRestore, onLocate, onReplace }: Props) {
  const copy = COPY[essay.subject].evaluation;
  const latest = evaluations[0];
  const isLatest = evaluation.id === latest?.id;
  const ordinal = evaluations.length - evaluations.findIndex((item) => item.id === evaluation.id);
  const delta = scoreDelta(evaluations);
  const fromOldDraft = evaluation.source.content !== essay.content;
  const scorePercent = percent(evaluation.score, evaluation.maxScore);

  return (
    <div className="space-y-4 text-xs">
      {evaluations.length > 1 && (
        <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-zinc-700">历次评分 ({evaluations.length})</span>
            {delta !== 0 && (
              <span className={cx('inline-flex items-center gap-0.5 font-semibold', delta > 0 ? 'text-emerald-700' : 'text-rose-600')}>
                <TrendingUp className="size-3" />
                {delta > 0 ? `累计提升 +${delta.toFixed(1)} 分` : `${delta.toFixed(1)} 分`}
              </span>
            )}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {evaluations.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={cx(
                  'flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[11px]',
                  item.id === evaluation.id ? 'border-accent bg-accent text-white' : 'border-zinc-200 bg-white text-zinc-600 hover:border-accent',
                )}
              >
                <b>{item.score}分</b>
                <span className="text-[10px] opacity-70">{item.id === latest?.id ? '最新' : formatDate(item.createdAt, { month: 'numeric', day: 'numeric' })}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!isLatest && (
        <aside className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-amber-900">
          <div className="flex items-center justify-between gap-1">
            <span className="flex items-center gap-1 font-semibold">
              <Clock className="size-3.5" />
              正在查看第 {ordinal} 次评分（{formatDate(evaluation.createdAt)}）
            </span>
            <button type="button" className="p-0.5 text-amber-700 hover:text-rose-600" title="删除此条评分" onClick={() => confirm('确认删除这条历史评分记录？') && onDelete(evaluation.id)}>
              <Trash2 className="size-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            {fromOldDraft && (
              <button type="button" className="btn min-h-6 px-2 text-[10px]" onClick={() => confirm('将此评分对应的原稿恢复到编辑器？') && onRestore(evaluation.source.content)}>
                <RotateCcw />
                恢复原稿至编辑器
              </button>
            )}
            {latest && (
              <button type="button" className="text-[10px] font-medium text-accent-strong underline" onClick={() => onSelect(latest.id)}>
                返回最新评分
              </button>
            )}
          </div>
        </aside>
      )}

      <section className="border-b border-zinc-200 pb-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-semibold text-zinc-500">
              总分
              {fromOldDraft && <span className="chip border border-zinc-200 bg-zinc-100 text-zinc-600">历史草稿评测</span>}
            </p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <strong className="text-3xl font-bold text-zinc-900">{evaluation.score}</strong>
              <span className="text-zinc-500">/ {evaluation.maxScore}</span>
            </p>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 font-semibold text-amber-800">
              <Star className="size-3.5" />
              {evaluation.band}
            </span>
            <p className="mt-1 text-zinc-500">
              得分率 {scorePercent}% · {countWords(evaluation.source.content, essay.subject)} {LENGTH_UNIT[essay.subject]}
            </p>
          </div>
        </div>
        <Meter value={scorePercent} className="mt-3 h-1.5 bg-accent" />
      </section>

      <section>
        <h4 className="mb-2 font-semibold text-zinc-900">{copy.dimensions}</h4>
        <div className="grid grid-cols-2 gap-2">
          {DIMENSION_KEYS.map((key) => {
            const dimension = evaluation.dimensions[key];
            return (
              <div key={key} className="border border-zinc-200 bg-white p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-zinc-700">{DIMENSIONS[essay.subject][key].label}</span>
                  <span className="font-mono font-semibold text-zinc-900">
                    {dimension.score}/{dimension.maxScore}
                  </span>
                </div>
                <Meter value={percent(dimension.score, dimension.maxScore)} className="mt-2 h-1 bg-zinc-500" />
                <p className="mt-2 leading-relaxed text-zinc-500">{dimension.feedback}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="border-t border-zinc-200 pt-3">
        <h4 className="font-semibold text-zinc-900">{copy.overall}</h4>
        <p className="mt-1.5 leading-relaxed text-zinc-600">{evaluation.overallComment}</p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Points title={copy.strengths} items={evaluation.strengths} tone="good" />
        <Points title={copy.weaknesses} items={evaluation.weaknesses} tone="bad" />
      </div>

      <section id="corrections" className="scroll-mt-3 border-t border-zinc-200 pt-3">
        <h4 className="font-semibold text-zinc-900">
          {COPY[essay.subject].sections.corrections} <span className="font-normal text-zinc-500">{evaluation.corrections.length} 处</span>
        </h4>
        {evaluation.corrections.length === 0 ? (
          <p className="mt-2 text-zinc-500">{copy.noCorrections}</p>
        ) : (
          <div className="mt-2 space-y-2">
            {evaluation.corrections.map((item, index) => (
              <article key={item.id} className="border border-zinc-200 bg-zinc-50 p-2.5">
                <p className="mb-1 text-[10px] font-semibold text-zinc-500">
                  {CORRECTION_LABELS[item.kind]} · {index + 1}
                </p>
                <p className="leading-relaxed text-rose-700 line-through decoration-rose-300">{item.original}</p>
                <p className="leading-relaxed text-emerald-700">{item.corrected}</p>
                <p className="mt-1.5 text-zinc-500">{item.explanation}</p>
                <TextActionButtons original={item.original} replacement={item.corrected} onLocate={onLocate} onReplace={onReplace} />
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Meter({ value, className }: { value: number; className: string }) {
  return (
    <div role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} className="overflow-hidden rounded-full bg-zinc-100">
      <div className={cx('rounded-full', className)} style={{ width: `${value}%` }} />
    </div>
  );
}

function Points({ title, items, tone }: { title: string; items: string[]; tone: 'good' | 'bad' }) {
  const Icon = tone === 'good' ? Check : AlertTriangle;
  const color = tone === 'good' ? 'text-emerald-700' : 'text-rose-700';
  return (
    <section>
      <h4 className={cx('flex items-center gap-1.5 font-semibold', color)}>
        {tone === 'good' ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
        {title}
      </h4>
      <ul className="mt-1.5 space-y-1 text-zinc-600">
        {items.map((item, index) => (
          <li key={index} className="flex gap-1.5">
            <Icon className={cx('mt-0.5 size-3.5 shrink-0', color)} />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TextActionButtons({ original, replacement, onLocate, onReplace }: TextActions & { original: string; replacement: string }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      <button type="button" className="btn min-h-7 px-2 text-[11px]" onClick={() => onLocate(original)} aria-label={`定位原句：${original}`}>
        <MapPin />
        定位原句
      </button>
      <button type="button" className="btn btn-primary min-h-7 px-2 text-[11px]" onClick={() => onReplace(original, replacement)} aria-label={`替换为：${replacement}`}>
        <Replace />
        替换
      </button>
    </div>
  );
}
