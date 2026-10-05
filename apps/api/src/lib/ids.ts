const PREFIXES = {
  essay: 'essay',
  version: 'ver',
  evaluation: 'eval',
  inspiration: 'insp',
  template: 'tpl',
} as const;

export type IdKind = keyof typeof PREFIXES;

export const newId = (kind: IdKind) => `${PREFIXES[kind]}-${crypto.randomUUID()}`;

export const now = () => new Date().toISOString();
