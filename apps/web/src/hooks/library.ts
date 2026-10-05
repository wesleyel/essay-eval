import type { Subject, Template } from '@essay/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { keys } from './essays';

export function useTemplateLibrary(subject: Subject) {
  const client = useQueryClient();
  const key = keys.templates(subject);
  const setList = (update: (list: Template[]) => Template[]) => client.setQueryData<Template[]>(key, (list) => update(list ?? []));

  return {
    templates: useQuery({ queryKey: key, queryFn: () => api.templates.list(subject) }),
    extract: useMutation({
      mutationFn: (essayId?: string) => api.templates.extract({ subject, essayId }),
      onSuccess: (added) => setList((list) => [...added, ...list]),
    }),
    remove: useMutation({
      mutationFn: api.templates.delete,
      onSuccess: (_, id) => setList((list) => list.filter((item) => item.id !== id)),
    }),
  };
}

export function useSettings() {
  const client = useQueryClient();
  return {
    settings: useQuery({ queryKey: keys.settings, queryFn: api.settings.get }),
    save: useMutation({ mutationFn: api.settings.save, onSuccess: (view) => client.setQueryData(keys.settings, view) }),
    test: useMutation({ mutationFn: api.settings.test }),
  };
}
