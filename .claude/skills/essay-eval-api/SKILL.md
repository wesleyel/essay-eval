---
name: essay-eval-api
description: 通过 EssayPilot 的 REST API 增删改查题目与作答、保存版本快照、发起 AI 评分/启发/语料提取。当需要以编程方式读写作文数据或触发批改时使用。
---

# EssayPilot API

API 由 Cloudflare Worker 提供（`apps/api`），路径前缀 `/api`，JSON 收发，**无鉴权**——仅在本地或受信网络使用。
本地：`pnpm dev` 后为 `http://127.0.0.1:8787/api`；部署后为 Worker 域名 + `/api`。
GitHub Pages 的纯浏览器模式没有 HTTP API，本 skill 不适用。

类型定义见 `packages/domain/src`，错误统一返回 `{ "error": "..." }`（400 校验、404 不存在、502 模型出错）。

## 枚举

- `subject`：`english` | `politics`
- `type`：english → `part-a`（小作文 10 分）、`part-b`（大作文 20 分）；politics → `mayuan` `maozhongte` `shigang` `defa` `dangdai`。type 必须属于 subject，subject 创建后不可改。

## 题目/作答（essay）

| 操作 | 请求 | 说明 |
|---|---|---|
| 列表 | `GET /essays?subject=&type=` | 摘要，不含图片，带最新评分与计数 |
| 详情 | `GET /essays/:id` | `{ essay, evaluations, versions, inspiration }`，新的在前 |
| 创建 | `POST /essays` | `{ subject, type, category, tags, title?, prompt?, promptImage?, content? }`，201。`type`、`tags` 必填；有分类的题型还需 `category` |
| 更新 | `PATCH /essays/:id` | 任意可编辑字段：`type title category tags prompt promptImage content`；其他字段会被拒绝 |
| 删除 | `DELETE /essays/:id` | 204，级联删除版本/评分/启发 |

- **分类 `category`**：题型之下的一级归类，各题型互不相交——`part-a`：`建议信`/`推荐信`/`邀请信`/`致歉信`/`申请求助信`/`咨询回复`/`通知`；`part-b`：`图画·人生态度`/`图画·品德情感`/`图画·教育成长`/`图画·文化社会`/`图表·柱状图`/`图表·表格`/`图表·组合图`；政治各题型无分类，`category` 必须为空串。题型与分类不匹配返回 400；PATCH 改 `type` 时必须同时给出新题型下的 `category`。
- **主题标签 `tags`**：作文表述的主题（如 `["坚持","环保"]`），至少 1 个、至多 10 个、每个不超过 20 字，服务端会去空白去重。PATCH 时 `tags` 不能清空。
- `prompt` = 题目要求，`content` = 作答正文；`promptImage` 为 `data:image/...;base64,` 且需小于约 1.2MB。
- 字数由服务端按科目计算（英文按词，政治按字）。

## 版本快照

- `POST /essays/:id/versions` `{ note? }` → 保存当前作答快照，201
- `DELETE /essays/:id/versions/:versionId` → 删除版本（其评分一并删除）
- `DELETE /essays/:id/evaluations/:evaluationId` → 只删评分，保留版本

## AI 操作（需先在设置里配置模型）

- `POST /essays/:id/evaluations` → 评分，返回 `{ evaluation, version }`，并自动生成版本快照。`content` 为空返回 400。耗时数十秒，请设置长超时。
- `POST /essays/:id/inspiration` → 表达启发（每篇仅保留最新一次）
- `POST /essays/:id/title` → `{ title }`，仅生成建议，不会写入；需要时自行 `PATCH`
- `POST /templates/extract` `{ subject, essayId? }` → 从作答提取句式/金句入库，省略 essayId 则取该科目全部有正文的作答，201

`evaluation` 关键字段：`score maxScore band dimensions overallComment strengths weaknesses corrections[] polished source createdAt`。

## 语料库

- `GET /templates?subject=`（每条带 `source: { essayId, title, type, category, tags }`，即来源作答的分类与主题，语料库据此做两级筛选；来源被删除则为 null） · `DELETE /templates/:id`

## 设置与备份

- `GET /settings` → `{ baseUrl, model, reasoningEffort, apiKeySet }`（不返回密钥）
- `PUT /settings` `{ baseUrl, model, reasoningEffort: auto|none|low|medium|high, apiKey? }`：省略 apiKey 沿用旧值，空串清除
- `POST /settings/test`（同 PUT 的 body）→ `{ ok, message }`
- `GET /backup` → 全量导出

## 典型流程

```bash
B=http://127.0.0.1:8787/api
ID=$(curl -s -X POST $B/essays -H 'content-type: application/json' \
  -d '{"subject":"english","type":"part-b","prompt":"题目...","content":"作文..."}' | jq -r .id)
curl -s -X POST $B/essays/$ID/evaluations --max-time 180 | jq '.evaluation | {score,maxScore,band}'
curl -s -X PATCH $B/essays/$ID -H 'content-type: application/json' -d '{"content":"修改后..."}'
```

## 注意

- 改动作答后评分不会自动重跑；对比提分请再次 `POST /evaluations`，历史在 `versions`/`evaluations` 中。
- 删除不可恢复；批量改动前先 `GET /backup`。
