import type { Subject } from '@essay/domain';
import { englishPrompts } from './english';
import { politicsPrompts } from './politics';
import type { SubjectPrompts } from './types';

export const PROMPTS: { [S in Subject]: SubjectPrompts<S> } = {
  english: englishPrompts,
  politics: politicsPrompts,
};
