/** Financial forms store civil dates, including dates serialized at midnight UTC.
 * Trip timestamps are instants and must instead use the viewer's local timezone.
 */
export function metricDate(value: string | null | undefined, civil = false): Date | null {
  if (!value) return null;
  let date: Date;
  if (civil) {
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T| )/.exec(value);
    if (!match) return null;
    const [, y, m, d] = match;
    date = new Date(Number(y), Number(m) - 1, Number(d));
    if (date.getFullYear() !== Number(y) || date.getMonth() !== Number(m) - 1 || date.getDate() !== Number(d)) return null;
  } else {
    date = new Date(value);
  }
  return Number.isFinite(date.getTime()) ? date : null;
}

export function civilDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** N calendar days: today and the preceding N-1 days, inclusive; future days excluded. */
export function periodBounds(days: number, now = new Date()) {
  if (!Number.isInteger(days) || days <= 0) throw new Error('Período inválido.');
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { start, end, civilStart: civilDateKey(start), civilEnd: civilDateKey(end) };
}

export function isInPeriod(value: string | null | undefined, days?: number, now = new Date(), civil = false): boolean {
  const date = metricDate(value, civil);
  if (!date) return false;
  if (days === undefined) return true;
  const { start, end } = periodBounds(days, now);
  return date >= start && date < end;
}

export function monthKey(value: string | null | undefined, civil = false): string | null {
  const date = metricDate(value, civil);
  return date ? civilDateKey(date).slice(0, 7) : null;
}

export function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}
