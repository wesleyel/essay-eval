import { useEffect, useState } from 'react';

/** 仅用于界面偏好的本地存储状态；读写失败时退回内存状态 */
export function useLocalState<T>(key: string, initial: T, accept: (value: unknown) => value is T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      const parsed: unknown = raw === null ? null : JSON.parse(raw);
      return accept(parsed) ? parsed : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* 隐私模式等场景下忽略 */
    }
  }, [key, value]);
  return [value, setValue];
}
