const PAGE_SIZE = 500;

/** Keep totals independent of the Data API response cap. Caller supplies stable ordering. */
export async function readAllPages<T>(load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ;) {
    const { data, error } = await load(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data || [];
    if (page.length === 0) return rows;
    rows.push(...page);
    // The server may impose a cap smaller than requested; a partial page isn't proof of EOF.
    from += page.length;
  }
}
