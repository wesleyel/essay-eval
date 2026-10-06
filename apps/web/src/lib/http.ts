import { handleLocal } from './local/handler';

/** 纯静态部署（如 GitHub Pages）时没有后端：数据存 IndexedDB，模型由浏览器直连 */
export const LOCAL_MODE = import.meta.env.PUBLIC_BACKEND === 'local';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  if (LOCAL_MODE) {
    // 与网络路径保持同样的 JSON 往返语义（去掉 undefined 等）
    const { status, data } = await handleLocal(method, path, body === undefined ? undefined : JSON.parse(JSON.stringify(body)));
    if (status === 204) return undefined as T;
    if (status >= 400) throw new ApiError(status, (data as { error?: string }).error ?? `请求失败 (HTTP ${status})`);
    return data as T;
  }
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, '无法连接评测服务');
  }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, (data as { error?: string } | null)?.error ?? `请求失败 (HTTP ${response.status})`);
  return data as T;
}

export const http = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown = {}) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: (path: string) => request<void>('DELETE', path),
};

export const errorMessage = (error: unknown) => (error instanceof Error ? error.message : '请求失败，请重试');

export function query(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])));
  return search.size ? `?${search}` : '';
}
