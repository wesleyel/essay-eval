# 架构

```
packages/domain   领域模型（零运行时依赖，仅 zod）
apps/api          Hono Worker：REST API + 托管前端静态资源，数据存 D1（Drizzle）
apps/web          Astro 静态站点，React 岛屿渲染工作台
```

依赖方向严格单向：`web → domain ← api`。前端不依赖后端实现，双方只通过 `@essay/domain` 里的类型与 zod 输入校验约定接口。

### 领域模型（`packages/domain`）

所有“按科目分支”的规则都在这里查表，其余代码不写 `if (subject === 'politics')`：

| 模块 | 内容 |
| --- | --- |
| `subject.ts` | 科目、题型、`EssayKind` 可辨识联合（类型层面排除跨科目题型）、`TYPE_SPECS`（满分/篇幅） |
| `review.ts` | 四维评分权重、按科目分组的纠错类别 / 句子功能，`Evaluation<S>`、`Inspiration<S>` 等泛型 |
| `template.ts` | 语料类别与 `Template<S>` |
| `essay.ts` | `Essay`、`EssaySummary`、`EssayDetail`、`Version` 及 API 输入 schema |
| `text.ts` | 计数（英语按词、政治按字）、diff 切分、篇幅状态 |

### API（`apps/api`）

```
routes/        HTTP 层：只做校验与转发
services/      编排：ReviewService 以科目为类型参数调用提示词与输出 schema
repositories/  D1 读写（Drizzle），返回领域对象
prompts/       每个科目一份 SubjectPrompts<S>，共用部分由领域表生成
llm/           OpenAI 兼容客户端 + 模型输出 → 领域对象的适配层（宽容解析、分数钳制、枚举回落）
db/            表结构、行 → 领域对象映射
```

数据约束直接写进 D1：`essays` 上有 CHECK 约束保证科目与题型匹配；评分与版本一一对应，删除版本会级联删除其评分，评分时的作答快照取自所属版本而不重复存储。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET / POST | `/api/essays` | 列表（`?subject=&type=`）/ 新建 |
| GET / PATCH / DELETE | `/api/essays/:id` | 详情（含评分、版本、启发）/ 局部更新 / 删除 |
| POST / DELETE | `/api/essays/:id/versions[/:versionId]` | 保存快照 / 删除版本 |
| POST / DELETE | `/api/essays/:id/evaluations[/:evaluationId]` | AI 评分（同时沉淀版本）/ 删除评分 |
| POST | `/api/essays/:id/inspiration` | AI 启发（每篇保留最新一次） |
| POST | `/api/essays/:id/title` | AI 生成标题 |
| GET / POST / DELETE | `/api/templates`、`/api/templates/extract`、`/api/templates/:id` | 语料库 |
| GET / PUT / POST | `/api/settings`、`/api/settings/test` | 模型配置（密钥只存服务端，不回传） |
| GET | `/api/backup` | 全量备份 |

### 前端（`apps/web`）

- 查询缓存即编辑状态：编辑先乐观写入 TanStack Query 缓存，再交给 `AutosaveQueue`（按记录合并、防抖、串行，失败可重试）。
- 随科目变化的文案集中在 `lib/copy.ts`；主题色由根节点 `data-subject` 切换 CSS 变量，组件只用 `accent` 色。
- AI 分析状态按 `['review', kind, essayId]` 归档，切换作答不会丢失其他作答上的进度。
