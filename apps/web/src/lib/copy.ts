/**
 * 界面文案。所有随科目变化的文字集中在这里，组件只按 COPY[subject] 取值；
 * 主题色由根节点的 data-subject 决定（见 global.css），组件里不再写科目分支。
 */
import type { EssayType, Subject } from '@essay/domain';

export interface SubjectCopy {
  tab: string;
  badge: string;
  heading: string;
  tagline: string;
  workbench: string;
  list: string;
  newEssay: string;
  untitled: string;
  searchPlaceholder: string;
  emptyList: string;
  firstEssay: string;
  review: { title: string; eyebrow: string; start: string; again: string; running: string };
  sections: { score: string; corrections: string; inspiration: string; templates: string; comparison: string };
  evaluation: { dimensions: string; overall: string; strengths: string; weaknesses: string; noCorrections: string; running: string };
  inspirationRunning: string;
  templatesRunning: string;
  polished: string;
  diffLegend: { removed: string; added: string; note: string };
  library: { button: string; eyebrow: string; title: string; description: string; extract: string; scopeAll: string; noun: string; empty: string };
  promptLabel: string;
  promptPlaceholder: string;
  contentLabel: string;
  snapshotPlaceholder: string;
}

export const COPY: Record<Subject, SubjectCopy> = {
  english: {
    tab: '英语写作',
    badge: '英',
    heading: '考研英语 · 写作批改与启发',
    tagline: '大纲规范 · 纠错润色 · 表达启发',
    workbench: '写作工作台',
    list: '英语习作列表',
    newEssay: '新建英语作文',
    untitled: '未命名作文',
    searchPlaceholder: '搜索标题、正文或题目',
    emptyList: '暂无作文记录，点击上方新建',
    firstEssay: '我的第一篇习作',
    review: { title: '批改与启发', eyebrow: 'REVIEW', start: '批改与启发', again: '重新批改', running: '正在批改' },
    sections: { score: '评分与纠错', corrections: '纠错', inspiration: '表达启发', templates: '语料沉淀', comparison: '全文对比' },
    evaluation: {
      dimensions: '考研四维度评分',
      overall: '总评',
      strengths: '优势',
      weaknesses: '待提升',
      noCorrections: '未发现需要修改的句子。',
      running: '正在对照大纲评阅…',
    },
    inspirationRunning: '正在提炼句式与词汇升级…',
    templatesRunning: '正在提取可迁移表达…',
    polished: '高分润色范文',
    diffLegend: { removed: '删改', added: '润色', note: '红底删除线为错误或不地道表达，绿底高亮为纠正与升级。' },
    library: {
      button: '我的语料库',
      eyebrow: 'TEMPLATE AGENT',
      title: '英语写作语料库',
      description: '只从英语作文里提取可迁移表达，不和政治金句混在一起。',
      extract: '从英语作文提取',
      scopeAll: '全部英语作文',
      noun: '模板',
      empty: '语料库还是空的。先写一篇英语作文，再点击“从英语作文提取”。',
    },
    promptLabel: '题目要求与背景说明',
    promptPlaceholder: '输入题目要求或背景说明',
    contentLabel: '作文正文',
    snapshotPlaceholder: '例如：初稿完成 / 第二段动词升级 / 模考交卷',
  },
  politics: {
    tab: '政治论述',
    badge: '政',
    heading: '考研政治 · 主观题评分与启发',
    tagline: '采点给分 · 政治话语 · 标答重构',
    workbench: '政治答题工作台',
    list: '政治答题列表',
    newEssay: '新建政治答题',
    untitled: '未命名政治作答',
    searchPlaceholder: '搜索标题、作答或材料',
    emptyList: '暂无政治答题记录，点击上方新建',
    firstEssay: '开始我的第一道政治大题演练',
    review: { title: '政治评分与启发', eyebrow: 'POLITICS REVIEW', start: '政治评分与启发', again: '重新评分', running: '正在评分' },
    sections: { score: '采点评分', corrections: '诊断纠偏', inspiration: '论述启发', templates: '金句沉淀', comparison: '标答对比' },
    evaluation: {
      dimensions: '政治阅卷四维度采分',
      overall: '阅卷专家总评',
      strengths: '采分亮点',
      weaknesses: '失分薄弱点',
      noCorrections: '作答表述规范，未发现明显原理偏误。',
      running: '正在对照大纲与核心采分点评阅…',
    },
    inspirationRunning: '正在提炼核心考点与金句变体…',
    templatesRunning: '正在提取可迁移公式与金句…',
    polished: '标准示范答卷',
    diffLegend: { removed: '原稿', added: '标答', note: '红底删除线是原稿表述，绿底高亮是标准答卷中的对应表述。' },
    library: {
      button: '政治金句库',
      eyebrow: 'POLITICS QUOTES',
      title: '政治金句库',
      description: '只从政治作答里提取可迁移的论述和金句，不和英语模板混在一起。',
      extract: '从政治作答提取',
      scopeAll: '全部政治作答',
      noun: '金句',
      empty: '金句库还是空的。先写一道政治大题，再点击“从政治作答提取”。',
    },
    promptLabel: '材料与具体设问要求',
    promptPlaceholder: '输入政治大题材料背景及具体设问，如第(1)问、第(2)问',
    contentLabel: '政治作答正文',
    snapshotPlaceholder: '例如：初稿完成 / 第(2)问补了采分点 / 模考交卷',
  },
};

const POLITICS_PLACEHOLDER =
  '在此输入政治分析题作答。建议采用考场高分三步法：【核心原理定性阐述】+【紧扣材料深入剖析】+【方法论与启示升华】，按小问标明①②③条理作答。';

export const CONTENT_PLACEHOLDER: Record<EssayType, string> = {
  'part-a': '在此开始写作。Part A 建议分三段完成。',
  'part-b': '在此开始写作。Part B 建议围绕图表或图画分三段展开。',
  mayuan: POLITICS_PLACEHOLDER,
  maozhongte: POLITICS_PLACEHOLDER,
  shigang: POLITICS_PLACEHOLDER,
  defa: POLITICS_PLACEHOLDER,
  dangdai: POLITICS_PLACEHOLDER,
};
