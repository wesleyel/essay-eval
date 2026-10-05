import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AutosaveQueue } from './autosave';

describe('AutosaveQueue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('debounces and merges patches per record', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const queue = new AutosaveQueue<{ title?: string; content?: string }>(save, 100);
    queue.schedule('a', { title: 'x' });
    queue.schedule('a', { content: 'y' });
    queue.schedule('a', { title: 'z' });
    expect(queue.getStatus('a')).toBe('saving');
    await vi.advanceTimersByTimeAsync(100);
    expect(save).toHaveBeenCalledExactlyOnceWith('a', { title: 'z', content: 'y' });
    expect(queue.getStatus('a')).toBe('saved');
  });

  it('serializes saves of the same record', async () => {
    const order: string[] = [];
    let release!: () => void;
    const save = vi.fn((_id: string, patch: { content: string }) => {
      order.push(`start ${patch.content}`);
      return patch.content === '1' ? new Promise<void>((resolve) => (release = () => (order.push('end 1'), resolve()))) : Promise.resolve(void order.push(`end ${patch.content}`));
    });
    const queue = new AutosaveQueue(save, 0);
    queue.schedule('a', { content: '1' });
    const first = queue.flush('a');
    queue.schedule('a', { content: '2' });
    const second = queue.flush('a');
    await vi.advanceTimersByTimeAsync(0);
    expect(order).toEqual(['start 1']);
    release();
    await Promise.all([first, second]);
    expect(order).toEqual(['start 1', 'end 1', 'start 2', 'end 2']);
  });

  it('keeps a failed patch for retry, newer edits winning', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const queue = new AutosaveQueue<{ title?: string; content?: string }>(save, 0);
    queue.schedule('a', { title: 'old', content: 'c' });
    await expect(queue.flush('a')).rejects.toThrow('offline');
    expect(queue.getStatus('a')).toBe('error');
    queue.schedule('a', { title: 'new' });
    await queue.flush('a');
    expect(save).toHaveBeenLastCalledWith('a', { title: 'new', content: 'c' });
    expect(queue.hasUnsaved()).toBe(false);
  });
});
