/**
 * 作答数据的读写。查询缓存是唯一数据源：编辑先乐观写入缓存，再交给自动保存队列。
 */
import { countWords, type Essay, type EssayDetail, type EssaySummary, type Subject, type UpdateEssayInput } from '@essay/domain';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { api } from '../lib/api';
import { AutosaveQueue } from '../lib/autosave';

export const keys = {
  essays: (subject: Subject) => ['essays', subject] as const,
  essay: (id: string) => ['essay', id] as const,
  templates: (subject: Subject) => ['templates', subject] as const,
  settings: ['settings'] as const,
};

export const autosave = new AutosaveQueue<UpdateEssayInput>((id, patch) => api.essays.update(id, patch));

export function useEssayList(subject: Subject) {
  return useQuery({ queryKey: keys.essays(subject), queryFn: () => api.essays.list({ subject }) });
}

export function useEssayDetail(id: string | null) {
  return useQuery({ queryKey: keys.essay(id ?? ''), queryFn: () => api.essays.get(id!), enabled: Boolean(id) });
}

export function useSaveStatus(id: string) {
  return useSyncExternalStore(autosave.subscribe, () => autosave.getStatus(id));
}

/** 在缓存里更新一篇作答的详情，并同步列表里的摘要 */
export function patchCachedEssay(client: QueryClient, essay: Essay, detail?: (previous: EssayDetail) => Partial<EssayDetail>) {
  client.setQueryData<EssayDetail>(keys.essay(essay.id), (previous) => previous && { ...previous, essay, ...detail?.(previous) });
  client.setQueryData<EssaySummary[]>(keys.essays(essay.subject), (list) =>
    list?.map((item) => {
      if (item.id !== essay.id) return item;
      const { promptImage, ...rest } = essay;
      const next = { ...item, ...rest, hasPromptImage: Boolean(promptImage) };
      const cached = client.getQueryData<EssayDetail>(keys.essay(essay.id));
      return cached
        ? { ...next, evaluationCount: cached.evaluations.length, versionCount: cached.versions.length, latestEvaluation: cached.evaluations[0] ?? null }
        : next;
    }),
  );
}

export function useEssayEditor() {
  const client = useQueryClient();
  return {
    update(essay: Essay, patch: UpdateEssayInput) {
      const next = {
        ...essay,
        ...patch,
        ...(patch.content !== undefined && { wordCount: countWords(patch.content, essay.subject) }),
        updatedAt: new Date().toISOString(),
      } as Essay;
      patchCachedEssay(client, next);
      autosave.schedule(essay.id, patch);
    },
    flush: (id: string) => autosave.flush(id),
  };
}

export function useCreateEssay() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.essays.create,
    onSuccess: (essay) => {
      const { promptImage, ...rest } = essay;
      client.setQueryData<EssaySummary[]>(keys.essays(essay.subject), (list) => [
        { ...rest, hasPromptImage: Boolean(promptImage), latestEvaluation: null, evaluationCount: 0, versionCount: 0 },
        ...(list ?? []),
      ]);
      client.setQueryData<EssayDetail>(keys.essay(essay.id), { essay, evaluations: [], versions: [], inspiration: null });
    },
  });
}

export function useDeleteEssay() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (essay: Pick<Essay, 'id' | 'subject'>) => {
      autosave.discard(essay.id);
      await api.essays.delete(essay.id);
      return essay;
    },
    onSuccess: ({ id, subject }) => {
      client.setQueryData<EssaySummary[]>(keys.essays(subject), (list) => list?.filter((item) => item.id !== id));
      client.removeQueries({ queryKey: keys.essay(id) });
    },
  });
}
