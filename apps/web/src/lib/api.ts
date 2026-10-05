/** 与 API Worker 的契约：路径在这里，类型全部来自 @essay/domain。 */
import type {
  AISettingsInput,
  AISettingsView,
  Backup,
  ConnectionTestResult,
  CreateEssayInput,
  CreateVersionInput,
  Essay,
  EssayDetail,
  EssayListQuery,
  EssaySummary,
  Evaluation,
  ExtractTemplatesInput,
  Inspiration,
  Subject,
  Template,
  UpdateEssayInput,
  Version,
} from '@essay/domain';
import { http, query } from './http';

const essay = (id: string) => `/essays/${encodeURIComponent(id)}`;

export const api = {
  essays: {
    list: (filter: EssayListQuery = {}) => http.get<EssaySummary[]>(`/essays${query(filter)}`),
    get: (id: string) => http.get<EssayDetail>(essay(id)),
    create: (input: CreateEssayInput) => http.post<Essay>('/essays', input),
    update: (id: string, patch: UpdateEssayInput) => http.patch<Essay>(essay(id), patch),
    delete: (id: string) => http.delete(essay(id)),
  },
  history: {
    snapshot: (id: string, input: CreateVersionInput) => http.post<Version>(`${essay(id)}/versions`, input),
    deleteVersion: (id: string, versionId: string) => http.delete(`${essay(id)}/versions/${versionId}`),
    deleteEvaluation: (id: string, evaluationId: string) => http.delete(`${essay(id)}/evaluations/${evaluationId}`),
  },
  review: {
    evaluate: (id: string) => http.post<{ evaluation: Evaluation; version: Version }>(`${essay(id)}/evaluations`),
    inspire: (id: string) => http.post<Inspiration>(`${essay(id)}/inspiration`),
    title: (id: string) => http.post<{ title: string }>(`${essay(id)}/title`),
  },
  templates: {
    list: (subject: Subject) => http.get<Template[]>(`/templates${query({ subject })}`),
    extract: (input: ExtractTemplatesInput) => http.post<Template[]>('/templates/extract', input),
    delete: (id: string) => http.delete(`/templates/${id}`),
  },
  settings: {
    get: () => http.get<AISettingsView>('/settings'),
    save: (input: AISettingsInput) => http.put<AISettingsView>('/settings', input),
    test: (input: AISettingsInput) => http.post<ConnectionTestResult>('/settings/test', input),
  },
  backup: () => http.get<Backup>('/backup'),
};
