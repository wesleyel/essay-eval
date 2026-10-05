import { zValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import type { z } from 'zod';

/** zod 校验；失败时返回统一的 { error } 结构 */
export const validate = <Target extends keyof ValidationTargets, Schema extends z.ZodType>(target: Target, schema: Schema) =>
  zValidator(target, schema, (result, c) => {
    if (!result.success) {
      const message = result.error.issues.map((issue) => `${issue.path.join('.') || target}: ${issue.message}`).join('；');
      return c.json({ error: message }, 400);
    }
  });
