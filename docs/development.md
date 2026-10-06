# 开发

需要 Node.js 22+ 与 pnpm（版本见根 `package.json` 的 `packageManager`）。

```bash
pnpm install
pnpm db:migrate     # 本地 D1 建表
pnpm db:seed        # 可选：写入 4 篇示例
pnpm dev            # wrangler dev :8787 + astro dev :4321（/api 代理到 8787）
```

打开 http://localhost:4321，在「设置」里填写模型服务。也可以用 `apps/api/.dev.vars` 里的 `AI_API_KEY` 作为兜底密钥。

```bash
pnpm typecheck
pnpm test
```

修改 `apps/api/src/db/schema.ts` 后运行 `pnpm --filter @essay/api db:generate` 生成新的迁移。
