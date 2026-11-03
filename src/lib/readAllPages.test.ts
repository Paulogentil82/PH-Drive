import { describe, expect, it, vi } from 'vitest';
import { readAllPages } from './readAllPages';

describe('complete metric reads', () => {
  it('continues after partial server-capped pages without skipping or duplicating records', async () => {
    const rows = Array.from({ length: 5 }, (_, id) => ({ id }));
    const load = vi.fn(async (from: number) => ({ data: rows.slice(from, from + 2), error: null }));
    expect(await readAllPages(load)).toEqual(rows);
    expect(load.mock.calls.map(([from]) => from)).toEqual([0, 2, 4, 5]);
  });
  it('rejects a later-page error instead of returning incomplete totals', async () => {
    const load = vi.fn().mockResolvedValueOnce({ data: [{ id: 1 }], error: null })
      .mockResolvedValueOnce({ data: null, error: new Error('second page failed') });
    await expect(readAllPages(load)).rejects.toThrow('second page failed');
  });
});
