/**
 * 科目与题型。
 *
 * 英语写作与政治论述是两个互不相通的板块：题型只属于一个科目，
 * 评分标准、纠错类别、启发功能、计数方式都随科目变化。
 * 这里是所有"按科目分支"的唯一来源，其余代码只查表，不写 if/else。
 */

export const SUBJECTS = ['english', 'politics'] as const;
export type Subject = (typeof SUBJECTS)[number];

export const ESSAY_TYPES = {
  english: ['part-a', 'part-b'],
  politics: ['mayuan', 'maozhongte', 'shigang', 'defa', 'dangdai'],
} as const satisfies Record<Subject, readonly string[]>;

export type EssayTypeOf<S extends Subject> = (typeof ESSAY_TYPES)[S][number];
export type EssayType = EssayTypeOf<Subject>;

export const ALL_ESSAY_TYPES = [...ESSAY_TYPES.english, ...ESSAY_TYPES.politics] as const satisfies readonly EssayType[];

/** 合法的 (科目, 题型) 组合；把两者放进同一个可辨识联合，类型层面就排除了跨板块题型。 */
export type EssayKind = { [S in Subject]: { subject: S; type: EssayTypeOf<S> } }[Subject];

export function isSubject(value: unknown): value is Subject {
  return (SUBJECTS as readonly unknown[]).includes(value);
}

export function isTypeOf<S extends Subject>(subject: S, type: unknown): type is EssayTypeOf<S> {
  return (ESSAY_TYPES[subject] as readonly unknown[]).includes(type);
}

/** 题型在两个科目间不重名，所以题型能唯一确定科目。 */
export function subjectOfType(type: EssayType): Subject {
  return isTypeOf('politics', type) ? 'politics' : 'english';
}

export const DEFAULT_TYPE: { [S in Subject]: EssayTypeOf<S> } = {
  english: 'part-a',
  politics: 'mayuan',
};

/** 每个题型的考试规格：满分与建议篇幅。 */
export interface TypeSpec {
  label: string;
  shortLabel: string;
  /** 写进提示词的完整板块名 */
  examName: string;
  maxScore: number;
  length: { min: number; max: number };
}

export const TYPE_SPECS: { [T in EssayType]: TypeSpec } = {
  'part-a': {
    label: 'Part A 小作文',
    shortLabel: 'Part A',
    examName: 'Part A 应用文书信/告示 (小作文，满分 10 分)',
    maxScore: 10,
    length: { min: 80, max: 120 },
  },
  'part-b': {
    label: 'Part B 大作文',
    shortLabel: 'Part B',
    examName: 'Part B 短文写作图画/图表 (大作文，满分 20 分)',
    maxScore: 20,
    length: { min: 160, max: 200 },
  },
  mayuan: {
    label: '34题 马原',
    shortLabel: '34题·马原',
    examName: '马克思主义基本原理 (第34题·马原)',
    maxScore: 10,
    length: { min: 350, max: 450 },
  },
  maozhongte: {
    label: '35题 毛中特·新思想',
    shortLabel: '35题·毛中特',
    examName: '毛泽东思想和中国特色社会主义理论体系与新时代思想 (第35题·毛中特)',
    maxScore: 10,
    length: { min: 350, max: 450 },
  },
  shigang: {
    label: '36题 史纲',
    shortLabel: '36题·史纲',
    examName: '中国近现代史纲要 (第36题·史纲)',
    maxScore: 10,
    length: { min: 350, max: 450 },
  },
  defa: {
    label: '37题 德法',
    shortLabel: '37题·德法',
    examName: '思想道德与法治 (第37题·德法)',
    maxScore: 10,
    length: { min: 350, max: 450 },
  },
  dangdai: {
    label: '38题 当代',
    shortLabel: '38题·当代',
    examName: '当代世界经济与政治 (第38题·当代)',
    maxScore: 10,
    length: { min: 350, max: 450 },
  },
};

/** 把独立存储的科目与题型组装成合法组合；不匹配时抛错。 */
export function essayKind(subject: Subject, type: EssayType): EssayKind {
  if (subject === 'english' && isTypeOf('english', type)) return { subject, type };
  if (subject === 'politics' && isTypeOf('politics', type)) return { subject, type };
  throw new TypeError(`题型 ${type} 不属于 ${subject} 板块`);
}
