import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '../../lib/supabase';
import { TripPoint } from '../../types';
import { addHomologationTestPoints, listTripPoints, tripPointSchema } from './tripPointsService';

vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn() } }));

const point = (sequence: number): TripPoint => ({
  id: `point-${sequence}`, trip_id: 'trip-1', user_id: 'user-1',
  latitude: 0, longitude: 0, accuracy_meters: null, speed_kmh: null,
  heading_degrees: null, altitude_meters: null,
  captured_at: '2026-10-01T12:00:00Z', sequence_number: sequence,
  source: 'MOBILE_GPS', created_at: '2026-10-01T12:00:00Z',
});

describe('listTripPoints', () => {
  beforeEach(() => vi.clearAllMocks());

  function mockPages(rows: TripPoint[], serverLimit = 500) {
    const cursors: number[] = [];
    vi.mocked(supabase.from).mockImplementation(() => {
      let cursor = -1;
      const query = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn((field, value) => {
          expect([field, value]).toEqual(['trip_id', 'trip-1']);
          return query;
        }),
        gt: vi.fn((field, value) => {
          expect(field).toBe('sequence_number');
          cursor = value;
          cursors.push(value);
          return query;
        }),
        order: vi.fn((field, options) => {
          expect([field, options]).toEqual(['sequence_number', { ascending: true }]);
          return query;
        }),
        limit: vi.fn(async (size) => ({
          data: rows.filter(p => p.sequence_number > cursor)
            .sort((a, b) => a.sequence_number - b.sequence_number)
            .slice(0, Math.min(size, serverLimit)),
          error: null,
        })),
      };
      return query as any;
    });
    return cursors;
  }

  it('returns one partial page followed by an empty final page', async () => {
    const rows = [point(0), point(1)];
    const cursors = mockPages(rows);
    expect(await listTripPoints('trip-1')).toEqual(rows);
    expect(cursors).toEqual([-1, 1]);
  });

  it('returns thousands of points in sequence order without duplicates', async () => {
    const rows = Array.from({ length: 2501 }, (_, i) => point(i * 2)).reverse();
    const cursors = mockPages(rows);
    const result = await listTripPoints('trip-1');
    expect(result.map(p => p.sequence_number)).toEqual(
      Array.from({ length: 2501 }, (_, i) => i * 2),
    );
    expect(new Set(result.map(p => p.id)).size).toBe(2501);
    expect(cursors).toEqual([-1, 998, 1998, 2998, 3998, 4998, 5000]);
  });

  it('continues through partial pages when the server imposes a smaller limit', async () => {
    const rows = Array.from({ length: 7 }, (_, i) => point(i));
    const cursors = mockPages(rows, 3);
    expect(await listTripPoints('trip-1')).toEqual(rows);
    expect(cursors).toEqual([-1, 2, 5, 6]);
  });

  it('requests an empty final page after an exact full page', async () => {
    const rows = Array.from({ length: 500 }, (_, i) => point(i));
    const cursors = mockPages(rows);
    expect(await listTripPoints('trip-1')).toEqual(rows);
    expect(cursors).toEqual([-1, 499]);
  });

  it('returns an empty list for a trip without points', async () => {
    mockPages([]);
    expect(await listTripPoints('trip-1')).toEqual([]);
  });

  it('propagates a later page error instead of returning incomplete data', async () => {
    const error = { message: 'remote failure' };
    const limit = vi.fn()
      .mockResolvedValueOnce({ data: [point(0)], error: null })
      .mockResolvedValueOnce({ data: null, error });
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit };
    vi.mocked(supabase.from).mockReturnValue(query as any);
    await expect(listTripPoints('trip-1')).rejects.toBe(error);
  });
});

describe('heading boundaries', () => {
  it.each([[0, true], [359.999, true], [360, false], [-1, false]])(
    'heading %s has validity %s', (heading, valid) => {
      expect(tripPointSchema.safeParse({ ...point(0), heading_degrees: heading }).success).toBe(valid);
    },
  );
});

describe('development-only fictitious points', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('rejects production calls before any remote access', async () => {
    vi.clearAllMocks();
    vi.stubEnv('DEV', false);
    await expect(addHomologationTestPoints('trip-1', 'user-1')).rejects.toThrow('somente em desenvolvimento');
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
