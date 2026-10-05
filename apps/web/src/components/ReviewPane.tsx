import { DIMENSION_KEYS, DIMENSIONS, TYPE_SPECS, isStale, snapshotOf, type Essay, type EssayDetail, type Evaluation } from '@essay/domain';
import { AlertCircle, BookMarked, Check, Library, Lightbulb, Loader2, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ReviewKind, useReview } from '../hooks/review';
import { COPY } from '../lib/copy';
import { DiffView } from './DiffView';
import { EvaluationView, type TextActions } from './EvaluationView';
import { InspirationView } from './InspirationView';
import { TemplateCard } from './TemplateCard';
import { Empty, Section } from './ui';

interface Props extends TextActions {
  essay: Essay;
  detail: EssayDetail;
  evaluation: Evaluation | undefined;
  review: ReturnType<typeof useReview>;
  onSelectEvaluation: (id: string) => void;
  onDeleteEvaluation: (id: string) => void;
  onRestore: (content: string) => void;
}

export function ReviewPane({ essay, detail, evaluation, review, onSelectEvaluation, onDeleteEvaluation, onRestore, onLocate, onReplace }: Props) {
  const copy = COPY[essay.subject];
  const { status, run, extracted } = review;
  const hasContent = Boolean(essay.content.trim());
  const analyzing = status.evaluation.busy || status.inspiration.busy || status.templates.busy;
  const current = snapshotOf(essay);
  const stale = [evaluation?.source, detail.inspiration?.source].some((source) => source && isStale(source, current));

  /** 每个分区的标题栏刷新按钮与状态行 */
  const controls = (kind: ReviewKind, running: string) => ({
    action: (
      <button type="button" className="btn btn-ghost btn-icon" aria-label="重新生成" title="重新生成" disabled={status[kind].busy || !hasContent} onClick={() => run(kind)}>
        <RefreshCw className={status[kind].busy ? 'animate-spin' : undefined} />
      </button>
    ),
    notices: (
      <>
        {status[kind].busy && (
          <p role="status" className="notice mb-3 bg-accent-wash text-accent-strong">
            <Loader2 className="animate-spin" />
            {running}
          </p>
        )}
        {status[kind].error && (
          <p role="alert" className="notice mb-3 border border-rose-200 bg-rose-50 text-rose-700">
            {status[kind].error}
          </p>
        )}
      </>
    ),
  });
  const sections = {
    evaluation: controls('evaluation', copy.evaluation.running),
    inspiration: controls('inspiration', copy.inspirationRunning),
    templates: controls('templates', copy.templatesRunning),
  };

  return (
    <aside id="feedback" aria-label={copy.review.title} className="flex min-h-0 min-w-0 flex-col bg-zinc-50">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-white px-5 py-3">
        <div>
          <span className="text-[10px] font-extrabold tracking-[0.12em] text-accent">{copy.review.eyebrow}</span>
          <h2 className="text-base font-bold text-zinc-900">{copy.review.title}</h2>
        </div>
        <span className="text-[11px] text-zinc-500">{analyzing ? '分析中' : evaluation ? '已完成' : '待评分'}</span>
      </div>
      <nav aria-label="反馈章节" className="flex gap-0.5 overflow-x-auto border-b border-zinc-200 bg-white px-3 py-1.5">
        {(
          [
            ['score', copy.sections.score],
            ['corrections', `${copy.sections.corrections}${evaluation ? ` ${evaluation.corrections.length}` : ''}`],
            ['inspiration', copy.sections.inspiration],
            ['templates', copy.sections.templates],
            ['comparison', copy.sections.comparison],
          ] as const
        ).map(([id, label]) => (
          <a key={id} href={`#${id}`} className="rounded px-2 py-1 text-[11px] font-bold whitespace-nowrap text-zinc-500 hover:bg-accent-wash hover:text-accent-strong">
            {label}
          </a>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {stale && (
          <p className="notice mx-5 mt-3 border border-amber-200 bg-amber-50 text-amber-800">
            <AlertCircle />
            反馈基于旧作答或历史版本，修改后可重新评分。
          </p>
        )}

        <Section id="score" icon={<Check />} title={copy.sections.score} action={sections.evaluation.action}>
          {sections.evaluation.notices}
          {evaluation ? (
            <EvaluationView
              essay={essay}
              evaluation={evaluation}
              evaluations={detail.evaluations}
              onSelect={onSelectEvaluation}
              onDelete={onDeleteEvaluation}
              onRestore={onRestore}
              onLocate={onLocate}
              onReplace={onReplace}
            />
          ) : (
            <ScorePlaceholder essay={essay} />
          )}
        </Section>

        <Section id="inspiration" icon={<Lightbulb />} title={copy.sections.inspiration} action={sections.inspiration.action}>
          {sections.inspiration.notices}
          {detail.inspiration ? (
            <InspirationView inspiration={detail.inspiration} onLocate={onLocate} onReplace={onReplace} />
          ) : (
            <Empty icon={<Lightbulb />}>{hasContent ? '尚未生成启发。' : '输入正文后即可生成启发分析。'}</Empty>
          )}
        </Section>

        <Section id="templates" icon={<BookMarked />} title={copy.sections.templates} action={sections.templates.action}>
          {sections.templates.notices}
          {extracted.length ? (
            <div className="grid gap-2">
              {extracted.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          ) : (
            <Empty icon={<Library />}>本次会话尚未提取到新的{copy.library.noun}。</Empty>
          )}
        </Section>

        <Section id="comparison" title={copy.sections.comparison}>
          {evaluation ? (
            <DiffView subject={essay.subject} original={evaluation.source.content} revised={evaluation.polished} />
          ) : (
            <p className="py-5 text-[11px] text-zinc-500">暂无{copy.polished}</p>
          )}
        </Section>
      </div>
    </aside>
  );
}

function ScorePlaceholder({ essay }: { essay: Essay }): ReactNode {
  return (
    <Empty>
      <span className="text-3xl font-extrabold text-accent">
        -- <small className="text-sm font-semibold text-zinc-400">/ {TYPE_SPECS[essay.type].maxScore}</small>
      </span>
      <p className="mt-2 mb-3">{essay.content.trim() ? '尚未评分' : '作答内容为空'}</p>
      <div className="grid grid-cols-4 gap-1 text-[10px] text-zinc-400">
        {DIMENSION_KEYS.map((key) => (
          <span key={key} className="rounded bg-zinc-100 px-0.5 py-1">
            {DIMENSIONS[essay.subject][key].label}
          </span>
        ))}
      </div>
    </Empty>
  );
}
