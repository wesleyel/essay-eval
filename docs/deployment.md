# 部署

```bash
cd apps/api
npx wrangler d1 create essay-eval   # 把输出的 database_id 填入 wrangler.jsonc
pnpm db:migrate:remote
cd ../.. && pnpm deploy             # 构建前端并部署 Worker
```

> 应用本身没有登录。部署到公网前，请用 Cloudflare Access 等方式保护站点，否则任何人都能调用你配置的模型密钥。

## 从旧版（Express + SQLite）迁移数据

```bash
pnpm --filter @essay/api db:import-legacy /path/to/server/data/essay.db
pnpm --filter @essay/api exec wrangler d1 execute essay-eval --local --file .wrangler/legacy-import.sql
```

旧库只读打开；评分与启发会经过与线上相同的校验归一。API Key 不迁移，导入后在设置页重新填写。部署后把 `--local` 换成 `--remote` 导入线上库。
