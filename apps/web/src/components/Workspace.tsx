/** 单篇作答的工作区：编辑器 + 评阅面板 + 历史记录。以 essay.id 为 key 挂载，切换作答即重置局部状态。 */
import type { EssayDetail, UpdateEssayInput } from '@essay/domain';
import { BookMarked, Download, Loader2, Sparkles } from 'lucide-react';
import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { useEssayEditor, useSaveStatus } from '../hooks/essays';
import { useHistoryActions, useReview } from '../hooks/review';
import { COPY } from '../lib/copy';
import { downloadMarkdown } from '../lib/export';
import { Editor, type EditorHandle } from './Editor';
import { HistoryDialog } from './HistoryDialog';
import { ReviewPane } from './ReviewPane';
import { useToast } from './ui';

const WIDTH = { min: 40, max: 65 };
const clampWidth = (value: number) => Math.min(WIDTH.max, Math.max(WIDTH.min, value));

export function Workspace({ detail, onOpenLibrary }: { detail: EssayDetail; onOpenLibrary: () => void }) {
  const { essay } = detail;
  const copy = COPY[essay.subject];
  const notify = useToast();
  const editor = useEssayEditor();
  const saveStatus = useSaveStatus(essay.id);
  const editorRef = useRef<EditorHandle>(null);
  const columns = useRef<HTMLDivElement>(null);
  const [editorWidth, setEditorWidth] = useState(55);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedEvaluationId, setSelectedEvaluationId] = useState<string>();
  const [undo, setUndo] = useState<{ before: string; after: string } | null>(null);

  const change = (patch: UpdateEssayInput) => editor.update(essay, patch);
  const review = useReview(essay, (title) => {
    change({ title });
    notify('标题已生成');
  });
  const history = useHistoryActions(essay);

  const evaluation = detail.evaluations.find((item) => item.id === selectedEvaluationId) ?? detail.evaluations[0];
  const analyzing = review.status.evaluation.busy || review.status.inspiration.busy || review.status.templates.busy;
  const hasContent = Boolean(essay.content.trim());

  /** 整体替换正文，并记录一步撤销 */
  function replaceContent(content: string, message: string) {
    setUndo({ before: essay.content, after: content });
    change({ content });
    notify(message);
  }

  function replaceText(original: string, replacement: string) {
    const first = original ? essay.content.indexOf(original) : -1;
    if (first < 0 || first !== essay.content.lastIndexOf(original)) {
      notify('原句已变更或出现多次，请在正文中确认后修改');
      return;
    }
    replaceContent(essay.content.replace(original, () => replacement), '已替换原句');
    requestAnimationFrame(() => editorRef.current?.locate(replacement));
  }

  function runAll() {
    for (const kind of ['evaluation', 'inspiration', 'templates'] as const) review.run(kind);
  }

  function resizeByPointer(event: PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || !columns.current) return;
    const bounds = columns.current.getBoundingClientRect();
    setEditorWidth(clampWidth(((event.clientX - bounds.left) / bounds.width) * 100));
  }

  function resizeByKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    setEditorWidth((width) => clampWidth(width + (event.key === 'ArrowLeft' ? -2 : 2)));
  }

  return (
    <>
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-2">
        <div className="flex items-center gap-2 text-xs font-bold text-zinc-700">
          <span className="size-1.5 rounded-full bg-accent ring-3 ring-accent-soft" />
          {copy.workbench}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn" onClick={onOpenLibrary}>
            <BookMarked />
            {copy.library.button}
          </button>
          <button type="button" className="btn btn-icon max-sm:hidden" title="导出为 Markdown" aria-label="导出为 Markdown" onClick={() => downloadMarkdown(detail)}>
            <Download />
          </button>
          <button type="button" className="btn btn-primary" disabled={analyzing || !hasContent} onClick={runAll}>
            {analyzing ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {analyzing ? copy.review.running : evaluation || detail.inspiration ? copy.review.again : copy.review.start}
          </button>
        </div>
      </div>

      <div
        ref={columns}
        style={{ '--editor-width': `${editorWidth}%` } as CSSProperties}
        className="min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[minmax(400px,var(--editor-width))_8px_minmax(340px,1fr)] lg:overflow-hidden"
      >
        <Editor
          ref={editorRef}
          essay={essay}
          onChange={change}
          saveStatus={saveStatus}
          onRetrySave={() => void editor.flush(essay.id).catch(() => notify('保存失败，请检查服务连接'))}
          onGenerateTitle={() => review.run('title')}
          titleBusy={review.status.title.busy}
          canUndo={undo?.after === essay.content}
          onUndo={() => {
            if (undo) change({ content: undo.before });
            setUndo(null);
          }}
          onOpenHistory={() => setHistoryOpen(true)}
          historyCount={Math.max(detail.versions.length, detail.evaluations.length)}
        />
        <div
          role="separator"
          tabIndex={0}
          aria-label="调整正文宽度"
          aria-orientation="vertical"
          aria-valuemin={WIDTH.min}
          aria-valuemax={WIDTH.max}
          aria-valuenow={Math.round(editorWidth)}
          onKeyDown={resizeByKey}
          onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
          onPointerMove={resizeByPointer}
          className="hidden cursor-col-resize border-x border-zinc-50 bg-zinc-200 hover:bg-accent-soft focus-visible:bg-accent-soft lg:block"
        />
        <ReviewPane
          essay={essay}
          detail={detail}
          evaluation={evaluation}
          review={review}
          onSelectEvaluation={setSelectedEvaluationId}
          onDeleteEvaluation={(id) => void history.deleteEvaluation(id).then(() => notify('评分记录已删除'), () => notify('删除失败'))}
          onRestore={(content) => replaceContent(content, '已恢复评分原稿')}
          onLocate={(text) => editorRef.current?.locate(text)}
          onReplace={replaceText}
        />
      </div>

      {historyOpen && (
        <HistoryDialog
          essay={essay}
          detail={detail}
          actions={history}
          onClose={() => setHistoryOpen(false)}
          onSelectEvaluation={setSelectedEvaluationId}
          onRestore={(content, note) => replaceContent(content, `已恢复至历史版本（${note}）`)}
        />
      )}
    </>
  );
}
