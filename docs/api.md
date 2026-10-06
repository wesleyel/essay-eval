# API

基础路径 `/api`。输入校验 schema 见 `packages/domain/src/essay.ts`。

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
