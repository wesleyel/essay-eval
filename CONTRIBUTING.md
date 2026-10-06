# 贡献指南

欢迎提交 Issue 与 Pull Request。

1. Fork 后基于 `main` 新建分支。
2. 本地环境见 [docs/development.md](docs/development.md)。
3. 提交前确保通过：

   ```bash
   pnpm typecheck
   pnpm test
   ```

4. 修改数据表结构（`apps/api/src/db/schema.ts`）时同时提交生成的迁移。
5. 保持分层：`web → domain ← api`，科目差异写进 `packages/domain` 的查表，不在业务代码里写科目分支。

提交信息建议使用 Conventional Commits（`feat:`、`fix:`、`docs:` 等）。

## 安全问题

请勿在公开 Issue 中披露密钥或漏洞细节，使用仓库的 Security → Report a vulnerability 私下提交。
