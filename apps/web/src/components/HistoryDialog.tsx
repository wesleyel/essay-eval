import { LENGTH_UNIT, type Essay, type EssayDetail, type Version } from '@essay/domain';
import { ArrowRight, BookmarkPlus, CheckCircle2, Clock, Eye, GitCompare, RotateCcw, Trash2, TrendingUp } from 'lucide-react';
import { Fragment, useState } from 'react';
import type { useHistoryActions } from '../hooks/review';
import { COPY } from '../lib/copy';
import { errorMessage } from '../lib/http';
import { DiffView } from './DiffView';
import { scoreDelta } from './EvaluationView';
import { cx, Dialog, formatDate, useToast } from './ui';

interface Props {
  essay: Essay;
  detail: EssayDetail;
  actions: ReturnType<typeof useHistoryActions>;
  onClose: () => void;
  onSelectEvaluation: (id: string) => void;
  onRestore: (content: string, note: string) => void;
}

export function HistoryDialog({ essay, detail, actions, onClose, onSelectEvaluation, onRestore }: Props) {
  const copy = COPY[essay.subject];
  const notify = useToast();
  const unit = LENGTH_UNIT[essay.subject];
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [comparing, setComparing] = useState<Version | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const chronological = [...detail.evaluations].reverse();
  const delta = scoreDelta(detail.evaluations);
  const evaluationById = new Map(detail.evaluations.map((item) => [item.id, item]));

  const attempt = async (task: () => Promise<void>, success: string) => {
    try {
      await task();
      notify(success);
    } catch (error) {
      notify(errorMessage(error));
    }
  };

  async function saveSnapshot() {
    setSaving(true);
    await attempt(() => actions.snapshot(note.trim()), '历史快照已保存');
    setNote('');
    setSaving(false);
  }

  const viewEvaluation = (id: string) => {
    onSelectEvaluation(id);
    onClose();
  };

  return (
    <Dialog
      title="历史记录与评分轨迹"
      subtitle={`${essay.title || copy.untitled} · ${detail.versions.length} 次快照 · ${detail.evaluations.length} 次评分`}
      onClose={onClose}
    >
      <div className="space-y-5">
        {chronological.length > 0 && (
          <div className="rounded-xl border border-accent-soft bg-accent-wash p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-zinc-900">
                <TrendingUp className="size-4 text-accent" />
                评分进步轨迹
              </span>
              {chronological.length > 1 && (
                <span className={cx('chip text-xs', delta > 0 ? 'bg-emerald-100 text-emerald-800' : delta < 0 ? 'bg-rose-100 text-rose-800' : 'bg-zinc-100 text-zinc-700')}>
                  {delta > 0 ? `累计提升 +${delta.toFixed(1)} 分` : delta === 0 ? '持平' : `${delta.toFixed(1)} 分`}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {chronological.map((item, index) => (
                <Fragment key={item.id}>
                  <button type="button" onClick={() => viewEvaluation(item.id)} className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-left text-xs hover:border-accent">
                    <span className="flex size-5 items-center justify-center rounded-full bg-accent-soft text-[10px] font-bold text-accent-strong">{index + 1}</span>
                    <span>
                      <b className="text-zinc-900">{item.score}</b>
                      <span className="text-[10px] text-zinc-400">/{item.maxScore}</span>
                      <span className="block text-[10px] text-zinc-400">{formatDate(item.createdAt, { dateStyle: 'short' })}</span>
                    </span>
                  </button>
                  {index < chronological.length - 1 && <ArrowRight className="size-3.5 text-accent" />}
                </Fragment>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={(event) => {
            event.preventDefault();
            void saveSnapshot();
          }} className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 sm:flex-row sm:items-center">
          <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-zinc-700">
            <BookmarkPlus className="size-4 text-accent" />
            保存当前版本快照
          </span>
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder={copy.snapshotPlaceholder} className="field py-1.5 text-xs" />
          <button type="submit" className="btn btn-primary shrink-0" disabled={saving || !essay.content.trim()}>
            {saving ? '正在保存…' : '保存快照'}
          </button>
        </form>

        {comparing && (
          <div className="space-y-2 rounded-xl border border-zinc-300 bg-zinc-50 p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-zinc-800">
                <GitCompare className="size-4 text-accent" />
                {comparing.note} ↔ 当前正文
              </span>
              <button type="button" className="text-xs text-zinc-500 hover:text-zinc-800" onClick={() => setComparing(null)}>
                关闭对比
              </button>
            </div>
            <DiffView subject={essay.subject} original={comparing.source.content} revised={essay.content} revisedLabel="当前正文" />
          </div>
        )}

        <section className="space-y-2.5">
          <h3 className="text-xs font-bold text-zinc-800">版本列表 ({detail.versions.length})</h3>
          {detail.versions.length === 0 && <p className="py-8 text-center text-xs text-zinc-400">暂无历史版本。保存快照或评分后会自动沉淀版本。</p>}
          {detail.versions.map((version) => {
            const evaluation = version.evaluationId ? evaluationById.get(version.evaluationId) : undefined;
            const isCurrent = version.source.content === essay.content;
            const previewing = previewId === version.id;
            return (
              <article key={version.id} className={cx('rounded-lg border p-3.5', isCurrent ? 'border-accent-soft bg-accent-wash' : 'border-zinc-200 bg-white')}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-zinc-900">{version.note}</span>
                      {isCurrent && <span className="chip bg-accent-soft text-accent-strong">与当前一致</span>}
                      {evaluation ? (
                        <span className="chip border border-emerald-200 bg-emerald-50 text-emerald-800">
                          <CheckCircle2 className="size-3" />
                          {evaluation.score}/{evaluation.maxScore}（{evaluation.band}）
                        </span>
                      ) : (
                        <span className="chip bg-zinc-100 text-zinc-600">草稿快照</span>
                      )}
                    </div>
                    <p className="mt-1 flex items-center gap-3 text-[11px] text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatDate(version.createdAt)}
                      </span>
                      <span>
                        {version.wordCount} {unit}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    <button type="button" className="btn min-h-7" onClick={() => setPreviewId(previewing ? null : version.id)}>
                      <Eye />
                      {previewing ? '收起' : '预览'}
                    </button>
                    <button type="button" className="btn min-h-7" onClick={() => setComparing(version)}>
                      <GitCompare />
                      对比
                    </button>
                    {evaluation && (
                      <button type="button" className="btn min-h-7" onClick={() => viewEvaluation(evaluation.id)}>
                        查看评分
                      </button>
                    )}
                    {!isCurrent && (
                      <button
                        type="button"
                        className="btn min-h-7"
                        onClick={() => {
                          if (!confirm(`将「${version.note}」恢复到编辑器？当前正文会被替换（可撤销）。`)) return;
                          onRestore(version.source.content, version.note);
                          onClose();
                        }}
                      >
                        <RotateCcw />
                        恢复
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon min-h-7 text-zinc-400 hover:text-rose-600"
                      title={evaluation ? '删除此版本及其评分' : '删除此版本'}
                      aria-label="删除此版本"
                      onClick={() => confirm(evaluation ? '删除此版本及其评分？' : '删除此版本？') && void attempt(() => actions.deleteVersion(version.id), '版本已删除')}
                    >
                      <Trash2 />
                    </button>
                  </div>
                </div>
                {previewing && (
                  <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 font-serif text-xs leading-relaxed whitespace-pre-wrap text-zinc-800">
                    {version.source.content || <span className="font-sans text-zinc-400">正文为空</span>}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      </div>
    </Dialog>
  );
}
