/**
 * 评分与启发的领域模型。
 * 维度、纠错类别、句子功能等枚举都按科目分组；带科目参数的泛型让
 * "政治评分里出现 spelling 纠错" 这类错误在类型层面不可表达。
 */
import type { EssayType, Subject } from './subject';

// ---------- 评分维度 ----------

export const DIMENSION_KEYS = ['content', 'language', 'structure', 'convention'] as const;
export type DimensionKey = (typeof DIMENSION_KEYS)[number];

export interface DimensionSpec {
  label: string;
  /** 占题目满分的比例，四项之和为 1 */
  weight: number;
  /** 写进提示词的考查要点 */
  criteria: string;
}

export const DIMENSIONS: Record<Subject, Record<DimensionKey, DimensionSpec>> = {
  english: {
    content: { label: '内容与切题', weight: 0.25, criteria: '内容要点覆盖与切题度：是否遗漏提纲要求/图画图表核心信息；立意是否偏题跑题。' },
    language: { label: '语言表达', weight: 0.25, criteria: '语法与词汇丰富度：词汇准确地道，杜绝中式直译；句式多样化（从句、非谓语、倒装等合理交替）。' },
    structure: { label: '结构与逻辑', weight: 0.25, criteria: '篇章结构与连贯逻辑：段落推进自然，衔接词不生硬机械；层次严密。' },
    convention: { label: '规范与格式', weight: 0.25, criteria: '语言规范性与准确度：拼写、标点符号、时态主谓搭配、格式称谓与语域得体性。' },
  },
  politics: {
    content: { label: '原理与采分点', weight: 0.35, criteria: '核心概念与基本原理是否准确，是否踩中参考答案的采分关键词。' },
    language: { label: '政治话语体系', weight: 0.2, criteria: '是否使用官方权威术语与时政金句，语言是否庄重凝练，有无白话、套话。' },
    structure: { label: '论述逻辑层次', weight: 0.2, criteria: '是否按设问分段，是否用“①②③”或“第一、第二”分点，逻辑是否递进。' },
    convention: { label: '材料结合深度', weight: 0.25, criteria: '是否把原理和材料写在一起，有无“两张皮”，方法论启示是否落到本题。' },
  },
};

export function dimensionMax(subject: Subject, maxScore: number, key: DimensionKey): number {
  return Math.round(DIMENSIONS[subject][key].weight * maxScore * 10) / 10;
}

export interface DimensionScore {
  score: number;
  maxScore: number;
  feedback: string;
}

// ---------- 纠错 ----------

export const CORRECTION_KINDS = {
  english: ['spelling', 'grammar', 'collocation', 'polish'],
  politics: ['concept', 'analysis', 'discourse', 'structure', 'grammar'],
} as const satisfies Record<Subject, readonly string[]>;

export type CorrectionKindOf<S extends Subject> = (typeof CORRECTION_KINDS)[S][number];
export type CorrectionKind = CorrectionKindOf<Subject>;

export const CORRECTION_LABELS: Record<CorrectionKind, string> = {
  spelling: '错别字',
  grammar: '语法语病',
  collocation: '词句搭配',
  polish: '润色精炼',
  concept: '原理纠偏',
  analysis: '材料结合',
  discourse: '话语规范',
  structure: '层次分点',
};

export interface Correction<S extends Subject = Subject> {
  id: string;
  original: string;
  corrected: string;
  kind: CorrectionKindOf<S>;
  explanation: string;
}

// ---------- 评分报告 ----------

/** LLM 产出、经校验后的评分内容 */
export interface EvaluationReport<S extends Subject = Subject> {
  score: number;
  maxScore: number;
  band: string;
  dimensions: Record<DimensionKey, DimensionScore>;
  overallComment: string;
  strengths: string[];
  weaknesses: string[];
  corrections: Correction<S>[];
  /** 英语为润色范文，政治为标准示范答卷 */
  polished: string;
}

/** 评分时的作答快照；用于判断反馈是否已过期 */
export interface SourceSnapshot {
  type: EssayType;
  prompt: string;
  content: string;
}

export function isStale(source: SourceSnapshot, current: SourceSnapshot): boolean {
  return source.content !== current.content || source.prompt !== current.prompt || source.type !== current.type;
}

export interface Evaluation<S extends Subject = Subject> extends EvaluationReport<S> {
  id: string;
  essayId: string;
  /** 每次评分都会沉淀一个版本快照，评分随版本删除 */
  versionId: string;
  source: SourceSnapshot;
  createdAt: string;
}

export type EvaluationSummary = Pick<Evaluation, 'id' | 'score' | 'maxScore' | 'band' | 'createdAt'>;

// ---------- 启发 ----------

export const SENTENCE_FUNCTIONS = {
  english: ['opening', 'trend', 'cause', 'transition', 'conclusion'],
  politics: ['opening', 'principle', 'analysis', 'countermeasure', 'conclusion'],
} as const satisfies Record<Subject, readonly string[]>;

export type SentenceFunctionOf<S extends Subject> = (typeof SENTENCE_FUNCTIONS)[S][number];
export type SentenceFunction = SentenceFunctionOf<Subject>;

export const SENTENCE_FUNCTION_LABELS: Record<SentenceFunction, string> = {
  opening: '破题立意',
  trend: '趋势/现状',
  cause: '原因分析',
  transition: '承上启下',
  conclusion: '总结升华',
  principle: '核心原理',
  analysis: '材料剖析',
  countermeasure: '方法论对策',
};

export const UPGRADE_CATEGORIES = ['trend', 'degree', 'logic', 'academic'] as const;
export type UpgradeCategory = (typeof UPGRADE_CATEGORIES)[number];

export const UPGRADE_CATEGORY_LABELS: Record<UpgradeCategory, string> = {
  trend: '趋势与动态',
  degree: '程度与分量',
  logic: '逻辑连贯',
  academic: '书面/理论用语',
};

export const SUBSTITUTE_LEVELS = ['advanced', 'native', 'master'] as const;
export type SubstituteLevel = (typeof SUBSTITUTE_LEVELS)[number];

export const SUBSTITUTE_LEVEL_LABELS: Record<SubstituteLevel, string> = {
  advanced: '核心提分',
  native: '地道/权威',
  master: '满分标答',
};

export interface ExtractedSentence<S extends Subject = Subject> {
  original: string;
  function: SentenceFunctionOf<S>;
  variations: string[];
  critique: string;
}

export interface Substitute {
  word: string;
  level: SubstituteLevel;
  nuance: string;
  example: string;
}

export interface WordUpgrade {
  word: string;
  context: string;
  category: UpgradeCategory;
  substitutes: Substitute[];
}

export interface InspirationReport<S extends Subject = Subject> {
  sentences: ExtractedSentence<S>[];
  upgrades: WordUpgrade[];
  structureTips: string[];
}

export interface Inspiration<S extends Subject = Subject> extends InspirationReport<S> {
  id: string;
  essayId: string;
  source: SourceSnapshot;
  createdAt: string;
}
