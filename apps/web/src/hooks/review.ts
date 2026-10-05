/**
 * AI 分析与历史记录操作。分析状态以 mutationKey ['review', kind, essayId] 归档，
 * 切换作答后仍能看到其他作答上正在进行的分析。
 */
import type { Essay, EssayDetail, Template } from '@essay/domain';
import { useIsMutating, useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { errorMessage } from '../lib/http';
import { autosave, keys, patchCachedEssay } from './essays';

export const REVIEW_KINDS = ['evaluation', 'inspiration', 'templates', 'title'] as const;
export type ReviewKind = (typeof REVIEW_KINDS)[number];

const reviewKey = (kind: ReviewKind, id: string) => ['review', kind, id] as const;
const extractedKey = (id: string) => ['extracted', id] as const;

function useReviewStatus(kind: ReviewKind, id: string) {
  const busy = useIsMutating({ mutationKey: reviewKey(kind, id) }) > 0;
  const errors = useMutationState({ filters: { mutationKey: reviewKey(kind, id) }, select: (mutation) => mutation.state.error });
  const error = errors.at(-1);
  return { busy, error: error ? errorMessage(error) : undefined };
}

export function useReview(essay: Essay, onTitle: (title: string) => void) {
  const client = useQueryClient();
  const id = essay.id;
  /** 先把未保存的编辑写入服务端，确保分析的是当前正文 */
  const saved = () => autosave.flush(id);
  const updateDetail = (change: (detail: EssayDetail) => Partial<EssayDetail>) => {
    const detail = client.getQueryData<EssayDetail>(keys.essay(id));
    if (detail) patchCachedEssay(client, detail.essay, change);
  };

  const mutations = {
    evaluation: useMutation({
      mutationKey: reviewKey('evaluation', id),
      mutationFn: () => saved().then(() => api.review.evaluate(id)),
      onSuccess: ({ evaluation, version }) =>
        updateDetail((detail) => ({ evaluations: [evaluation, ...detail.evaluations], versions: [version, ...detail.versions] })),
    }),
    inspiration: useMutation({
      mutationKey: reviewKey('inspiration', id),
      mutationFn: () => saved().then(() => api.review.inspire(id)),
      onSuccess: (inspiration) => updateDetail(() => ({ inspiration })),
    }),
    templates: useMutation({
      mutationKey: reviewKey('templates', id),
      mutationFn: () => saved().then(() => api.templates.extract({ subject: essay.subject, essayId: id })),
      onSuccess: (templates) => {
        client.setQueryData(extractedKey(id), templates);
        void client.invalidateQueries({ queryKey: keys.templates(essay.subject) });
      },
    }),
    title: useMutation({
      mutationKey: reviewKey('title', id),
      mutationFn: () => saved().then(() => api.review.title(id)),
      onSuccess: ({ title }) => onTitle(title),
    }),
  };

  const status = {
    evaluation: useReviewStatus('evaluation', id),
    inspiration: useReviewStatus('inspiration', id),
    templates: useReviewStatus('templates', id),
    title: useReviewStatus('title', id),
  } satisfies Record<ReviewKind, unknown>;

  const extracted = useQuery({ queryKey: extractedKey(id), queryFn: () => [] as Template[], initialData: [], staleTime: Infinity }).data;

  return {
    run: (kind: ReviewKind) => {
      if (!status[kind].busy) mutations[kind].mutate();
    },
    status,
    extracted,
  };
}

export function useHistoryActions(essay: Essay) {
  const client = useQueryClient();
  const id = essay.id;
  const updateDetail = (change: (detail: EssayDetail) => Partial<EssayDetail>) => {
    const detail = client.getQueryData<EssayDetail>(keys.essay(id));
    if (detail) patchCachedEssay(client, detail.essay, change);
  };

  return {
    snapshot: async (note: string) => {
      await autosave.flush(id);
      const version = await api.history.snapshot(id, { note: note || undefined });
      updateDetail((detail) => ({ versions: [version, ...detail.versions] }));
    },
    /** 删除版本会连带删除其评分 */
    deleteVersion: async (versionId: string) => {
      await api.history.deleteVersion(id, versionId);
      updateDetail((detail) => ({
        versions: detail.versions.filter((item) => item.id !== versionId),
        evaluations: detail.evaluations.filter((item) => item.versionId !== versionId),
      }));
    },
    deleteEvaluation: async (evaluationId: string) => {
      await api.history.deleteEvaluation(id, evaluationId);
      updateDetail((detail) => ({
        evaluations: detail.evaluations.filter((item) => item.id !== evaluationId),
        versions: detail.versions.map((item) => (item.evaluationId === evaluationId ? { ...item, evaluationId: null } : item)),
      }));
    },
  };
}
