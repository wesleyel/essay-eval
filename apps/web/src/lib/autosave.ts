/**
 * 按记录 id 合并、防抖并串行化的自动保存队列。
 * - 同一记录的修改合并为一个补丁，停止输入后统一提交；
 * - 同一记录的请求严格串行，避免旧请求覆盖新内容；
 * - 失败的补丁保留在队列里（新修改优先），可重试。
 * 与框架无关；React 通过 subscribe/getStatus 以 useSyncExternalStore 订阅。
 */
export type SaveStatus = 'saved' | 'saving' | 'error';

export class AutosaveQueue<Patch extends object> {
  private readonly pending = new Map<string, Patch>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly inflight = new Map<string, Promise<void>>();
  private readonly statuses = new Map<string, SaveStatus>();
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly save: (id: string, patch: Patch) => Promise<unknown>,
    private readonly delayMs = 450,
  ) {}

  schedule(id: string, patch: Patch): void {
    this.pending.set(id, { ...this.pending.get(id), ...patch });
    this.setStatus(id, 'saving');
    clearTimeout(this.timers.get(id));
    this.timers.set(
      id,
      setTimeout(() => void this.flush(id).catch(() => {}), this.delayMs),
    );
  }

  /** 立即提交该记录的待保存修改，并等待此前的请求完成 */
  flush(id: string): Promise<void> {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    const patch = this.pending.get(id);
    const previous = this.inflight.get(id) ?? Promise.resolve();
    if (!patch) return previous;
    this.pending.delete(id);

    const task = previous
      .catch(() => {})
      .then(() => this.save(id, patch))
      .then(
        () => {
          if (this.inflight.get(id) === task && !this.pending.has(id)) this.setStatus(id, 'saved');
        },
        (error: unknown) => {
          // 保留失败的补丁；期间产生的新修改覆盖其中相同字段
          this.pending.set(id, { ...patch, ...this.pending.get(id) });
          this.setStatus(id, 'error');
          throw error;
        },
      );
    this.inflight.set(id, task);
    return task;
  }

  /** 放弃某条记录的待保存修改（例如记录已删除） */
  discard(id: string): void {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.pending.delete(id);
    this.inflight.delete(id);
    this.statuses.delete(id);
    this.emit();
  }

  hasUnsaved(): boolean {
    return this.pending.size > 0 || [...this.statuses.values()].includes('saving');
  }

  getStatus = (id: string): SaveStatus => this.statuses.get(id) ?? 'saved';

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private setStatus(id: string, status: SaveStatus) {
    if (this.statuses.get(id) === status) return;
    this.statuses.set(id, status);
    this.emit();
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }
}
