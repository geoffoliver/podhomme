/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';

type SseListener = (event: string, data: unknown) => void;

let capturedListener: SseListener = () => {};

jest.mock('@/context/SseContext', () => ({
  useSse: (fn: SseListener) => { capturedListener = fn; },
}));

import { useRefreshScheduler } from '@/hooks/useRefreshScheduler';

const mockFetch = jest.fn();

beforeEach(() => {
  jest.useFakeTimers();
  capturedListener = () => {};
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ refreshFrequency: 60 }),
  });
  global.fetch = mockFetch;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useRefreshScheduler', () => {
  it('triggers a refresh immediately on mount', async () => {
    renderHook(() => useRefreshScheduler());
    await act(async () => {});

    expect(mockFetch).toHaveBeenCalledWith('/api/podcasts/refresh', { method: 'POST' });
  });

  it('schedules next refresh using nextRefreshIn when server says too_soon', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ skipped: true, reason: 'too_soon', nextRefreshIn: 30 * 60 * 1000 }),
    });

    renderHook(() => useRefreshScheduler());
    await act(async () => {});

    mockFetch.mockClear();

    // Should fire after nextRefreshIn (30 min), not after a full settings-based interval
    await act(async () => { jest.advanceTimersByTime(30 * 60 * 1000); });
    await act(async () => {});

    expect(mockFetch).toHaveBeenCalledWith('/api/podcasts/refresh', { method: 'POST' });
  });

  it('schedules the next refresh based on settings after SSE done:true', async () => {
    renderHook(() => useRefreshScheduler());
    await act(async () => {});

    mockFetch.mockClear();

    // Simulate the server SSE: refresh complete
    await act(async () => { capturedListener('refresh', { done: true }); });
    await act(async () => {}); // let scheduleNext fetch settings

    // Advance exactly 60 minutes
    await act(async () => { jest.advanceTimersByTime(60 * 60 * 1000); });
    await act(async () => {});

    expect(mockFetch).toHaveBeenCalledWith('/api/podcasts/refresh', { method: 'POST' });
  });

  it('cancels pending timer when SSE done:false fires (another tab is refreshing)', async () => {
    renderHook(() => useRefreshScheduler());
    await act(async () => {});

    // Get a timer scheduled
    await act(async () => { capturedListener('refresh', { done: true }); });
    await act(async () => {}); // let scheduleNext fetch settings

    mockFetch.mockClear();

    // Another tab starts a refresh — cancel our pending timer
    await act(async () => { capturedListener('refresh', { done: false }); });

    // Nothing should fire after the interval
    await act(async () => { jest.advanceTimersByTime(60 * 60 * 1000); });
    await act(async () => {});

    expect(mockFetch).not.toHaveBeenCalledWith('/api/podcasts/refresh', { method: 'POST' });
  });

  it('ignores non-refresh SSE events', async () => {
    renderHook(() => useRefreshScheduler());
    await act(async () => {});

    mockFetch.mockClear();

    await act(async () => { capturedListener('podcast', { id: 1 }); });
    await act(async () => { jest.advanceTimersByTime(60 * 60 * 1000); });
    await act(async () => {});

    expect(mockFetch).not.toHaveBeenCalledWith('/api/podcasts/refresh', { method: 'POST' });
  });

  it('cleans up the timer on unmount', async () => {
    const { unmount } = renderHook(() => useRefreshScheduler());
    await act(async () => {});

    await act(async () => { capturedListener('refresh', { done: true }); });
    await act(async () => {});

    mockFetch.mockClear();
    unmount();

    await act(async () => { jest.advanceTimersByTime(60 * 60 * 1000); });
    await act(async () => {});

    expect(mockFetch).not.toHaveBeenCalledWith('/api/podcasts/refresh', { method: 'POST' });
  });
});
