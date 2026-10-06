/** 极简 IndexedDB 封装：每个对象仓库一个 keyPath，按需建索引 */
const DB_NAME = 'essay-eval';
const DB_VERSION = 1;

export const STORES = {
  essays: 'essays',
  versions: 'versions',
  evaluations: 'evaluations',
  inspirations: 'inspirations',
  templates: 'templates',
  settings: 'settings',
} as const;
export type StoreName = (typeof STORES)[keyof typeof STORES];

let opened: Promise<IDBDatabase> | undefined;

function open(): Promise<IDBDatabase> {
  opened ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore(STORES.essays, { keyPath: 'id' });
      db.createObjectStore(STORES.versions, { keyPath: 'id' }).createIndex('essayId', 'essayId');
      db.createObjectStore(STORES.evaluations, { keyPath: 'id' }).createIndex('essayId', 'essayId');
      db.createObjectStore(STORES.inspirations, { keyPath: 'essayId' });
      db.createObjectStore(STORES.templates, { keyPath: 'id' });
      db.createObjectStore(STORES.settings, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('数据库被其他标签页占用，请关闭其他标签页后重试'));
  });
  return opened;
}

const wrap = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

/** 事务内的仓库句柄；所有方法返回 Promise，需在同一事务回调内连续使用 */
export class Tx {
  constructor(private readonly tx: IDBTransaction) {}
  all = <T>(store: StoreName) => wrap<T[]>(this.tx.objectStore(store).getAll());
  get = <T>(store: StoreName, key: IDBValidKey) => wrap<T | undefined>(this.tx.objectStore(store).get(key));
  byIndex = <T>(store: StoreName, index: string, key: IDBValidKey) => wrap<T[]>(this.tx.objectStore(store).index(index).getAll(key));
  put = async (store: StoreName, value: unknown) => void (await wrap(this.tx.objectStore(store).put(value)));
  delete = async (store: StoreName, key: IDBValidKey) => void (await wrap(this.tx.objectStore(store).delete(key)));
}

/** 在一个事务中读写多个仓库；回调抛错则整个事务回滚 */
export async function transaction<T>(stores: StoreName[], mode: IDBTransactionMode, run: (tx: Tx) => Promise<T>): Promise<T> {
  const db = await open();
  const tx = db.transaction(stores, mode);
  const done = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('事务已中止'));
  });
  try {
    const result = await run(new Tx(tx));
    await done;
    return result;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* 事务已结束 */
    }
    done.catch(() => {});
    throw error;
  }
}
