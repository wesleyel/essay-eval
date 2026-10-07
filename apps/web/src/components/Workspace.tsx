/** 单篇作答的工作区：编辑器 + 评阅面板 + 历史记录。以 essay.id 为 key 挂载，切换作答即重置局部状态。 */
import { ESSAY_TYPES, LENGTH_UNIT, TYPE_SPECS, type EssayDetail, type UpdateEssayInput } from '@essay/domain';
import { BookMarked, Download, History, Loader2, Sparkles } from 'lucide-react';
import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { useEssayEditor, useSaveStatus } from '../hooks/essays';
import { useHistoryActions, useReview } from '../hooks/review';
import { COPY } from '../lib/copy';
import { libraryHref } from '../lib/library';
import { downloadMarkdown } from '../lib/export';
import { Editor, type EditorHandle } from './Editor';
import { HistoryDialog } from './HistoryDialog';
import { ReviewPane } from './ReviewPane';
import { Segmented, useToast } from './ui';

const WIDTH = { min: 40, max: 65 };
const clampWidth = (value: number) => Math.min(WIDTH.max, Math.max(WIDTH.min, value));

interface Props {
  detail: EssayDetail;
  /** 侧栏收起时显示的展开按钮 */
  sidebarToggle: ReactNode;
}

export function Workspace({ detail, sidebarToggle }: Props) {
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
  const length = TYPE_SPECS[essay.type].length;
  const historyCount = Math.max(detail.versions.length, detail.evaluations.length);

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
      <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b border-zinc-200 bg-white px-3 py-2">
        {sidebarToggle}
        <Segmented
          label="题型"
          value={essay.type}
          onChange={(type) => change({ type })}
          options={ESSAY_TYPES[essay.subject].map((value) => ({ value, label: TYPE_SPECS[value].label }))}
        />
        <span className="hidden text-xs text-zinc-400 md:inline">
          建议 {length.min}-{length.max} {LENGTH_UNIT[essay.subject]}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" className="btn" onClick={() => setHistoryOpen(true)} title="历史记录与评分轨迹">
            <History className="text-accent" />
            <span className="max-sm:hidden">历史记录</span>
            {historyCount > 0 && <span className="chip border border-accent-soft bg-accent-wash text-accent-strong">{historyCount}</span>}
          </button>
          <a className="btn" href={libraryHref(detail.essay.subject)} target="_blank" rel="noopener" title="在新页面打开">
            <BookMarked />
            <span className="max-sm:hidden">{copy.library.button}</span>
          </a>
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
