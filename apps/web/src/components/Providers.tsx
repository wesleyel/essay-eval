import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ToastProvider } from './ui';

// 缓存即编辑状态：输入框的值直接来自查询缓存。缓存通知默认延迟到下一个宏任务，
// 受控输入框会先被回写成旧值，导致光标跳到末尾、原生撤销失效；这里改为同步通知。
notifyManager.setScheduler((callback) => callback());

// 不自动重新拉取，避免覆盖尚未保存的本地修改
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, refetchOnWindowFocus: false, retry: 1 } },
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
