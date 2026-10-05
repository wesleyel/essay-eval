import type { Database } from './db/client';
import type { ReviewService } from './services/review';

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  /** 设置页未保存密钥时的兜底密钥（wrangler secret） */
  AI_API_KEY?: string;
}

export interface AppEnv {
  Bindings: Env;
  Variables: { db: Database; review: ReviewService };
}
