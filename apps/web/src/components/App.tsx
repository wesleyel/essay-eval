import { isSubject, type CreateEssayInput, type EssaySummary, type EssayType, type Subject } from '@essay/domain';
import { useIsMutating } from '@tanstack/react-query';
import { AlertCircle, Loader2, PanelLeftOpen, RefreshCw, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { autosave, useCreateEssay, useDeleteEssay, useEssayDetail, useEssayList } from '../hooks/essays';
import { useLocalState } from '../hooks/local-state';
import { api } from '../lib/api';
import { COPY } from '../lib/copy';
import { downloadBackup } from '../lib/export';
import { errorMessage } from '../lib/http';
import { NewEssayDialog } from './Classification';
import { Providers } from './Providers';
import { SettingsDialog } from './SettingsDialog';
import { Sidebar } from './Sidebar';
import { useToast } from './ui';
import { Workspace } from './Workspace';

export function App() {
  return (
    <Providers>
      <Workbench />
    </Providers>
  );
}

type DialogKind = 'settings' | 'create';
const isWide = () => window.matchMedia('(min-width: 1280px)').matches;

function Workbench() {
  const notify = useToast();
  const [subject, setSubject] = useLocalState<Subject>('essay-eval:subject', 'english', isSubject);
  const [selected, setSelected] = useState<Partial<Record<Subject, string>>>({});
  const [sidebarOpen, setSidebarOpen] = useState(isWide);
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [newType, setNewType] = useState<EssayType>();
  const copy = COPY[subject];

  const list = useEssayList(subject);
  const essays = list.data ?? [];
  const currentId = essays.find((essay) => essay.id === selected[subject])?.id ?? essays[0]?.id ?? null;
  const detail = useEssayDetail(currentId);
  const createEssay = useCreateEssay();
  const deleteEssay = useDeleteEssay();
  const reviewing = useIsMutating({ predicate: (mutation) => mutation.options.mutationKey?.[0] === 'review' && mutation.options.mutationKey[2] === currentId });

  useEffect(() => {
    document.documentElement.dataset.subject = subject;
  }, [subject]);

  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => autosave.hasUnsaved() && event.preventDefault();
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, []);

  function select(id: string) {
    if (currentId) void autosave.flush(currentId).catch(() => {});
    setSelected((previous) => ({ ...previous, [subject]: id }));
    if (!isWide()) setSidebarOpen(false);
  }

  function switchSubject(next: Subject) {
    if (currentId) void autosave.flush(currentId).catch(() => {});
    setSubject(next);
    setDialog(null);
  }

  function openCreate(type?: EssayType) {
    setNewType(type);
    setDialog('create');
  }

  function create(input: CreateEssayInput) {
    createEssay.mutate(input, {
      onSuccess: (essay) => {
        setDialog(null);
        select(essay.id);
      },
      onError: (error) => notify(errorMessage(error)),
    });
  }

  function remove(essay: EssaySummary) {
    if (essay.id === currentId && reviewing) return notify('分析进行中，请完成后再删除');
    if (!confirm(`删除「${essay.title}」及其全部评分与版本？此操作不可撤销。`)) return;
    deleteEssay.mutate(essay, { onError: (error) => notify(errorMessage(error)) });
  }

  async function backup() {
    try {
      await Promise.all(essays.map((essay) => autosave.flush(essay.id)));
      downloadBackup(await api.backup());
    } catch (error) {
      notify(errorMessage(error));
    }
  }

  const status = list.error ?? detail.error;
  /** 侧栏收起时，从工作区工具栏展开 */
  const sidebarToggle = sidebarOpen ? null : (
    <button type="button" className="btn btn-ghost btn-icon shrink-0" aria-label="展开侧栏" aria-controls="essay-list" title="展开侧栏" onClick={() => setSidebarOpen(true)}>
      <PanelLeftOpen />
    </button>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar
          subject={subject}
          onSubject={switchSubject}
          onBackup={() => void backup()}
          onSettings={() => setDialog('settings')}
          essays={essays}
          currentId={currentId}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onSelect={select}
          onCreate={openCreate}
          onDelete={remove}
        />
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {!detail.data && sidebarToggle && <div className="absolute top-2 left-2">{sidebarToggle}</div>}
          {status ? (
            <Placeholder>
              <AlertCircle className="size-6 text-rose-600" />
              <h2 className="text-base font-bold">无法连接评测服务</h2>
              <p>{errorMessage(status)}</p>
              <button type="button" className="btn" onClick={() => void (list.error ? list.refetch() : detail.refetch())}>
                <RefreshCw />
                重试
              </button>
            </Placeholder>
          ) : list.isPending || (currentId && !detail.data) ? (
            <Placeholder>
              <Loader2 className="size-6 animate-spin text-accent" />
              正在加载
            </Placeholder>
          ) : detail.data ? (
            <Workspace key={detail.data.essay.id} detail={detail.data} sidebarToggle={sidebarToggle} />
          ) : (
            <Placeholder>
              <h2 className="text-base font-bold text-zinc-800">{copy.firstEssay}</h2>
              <button type="button" className="btn btn-primary" disabled={createEssay.isPending} onClick={() => openCreate()}>
                <Sparkles />
                {copy.newEssay}
              </button>
            </Placeholder>
          )}
        </main>
      </div>

      {dialog === 'settings' && <SettingsDialog onClose={() => setDialog(null)} />}
      {dialog === 'create' && <NewEssayDialog subject={subject} initialType={newType} essays={essays} pending={createEssay.isPending} onCreate={create} onClose={() => setDialog(null)} />}
    </div>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-zinc-500">{children}</div>;
}
