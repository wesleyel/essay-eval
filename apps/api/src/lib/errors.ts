import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** 可预期的业务错误，带 HTTP 状态码；其余异常一律按 500 处理 */
export class AppError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new AppError(404, `${what}不存在`);
export const badRequest = (message: string) => new AppError(400, message);
/** 上游模型服务出错 */
export const upstreamError = (message: string) => new AppError(502, message);
