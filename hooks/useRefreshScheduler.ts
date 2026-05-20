'use client';

import { useEffect, useRef } from 'react';
import { useSse } from '@/context/SseContext';

export function useRefreshScheduler() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimer() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  async function scheduleNext() {
    clearTimer();
    try {
      const res = await fetch('/api/settings');
      const settings = await res.json();
      const intervalMs = (settings.refreshFrequency ?? 60) * 60 * 1000;
      timerRef.current = setTimeout(triggerRefresh, intervalMs);
    } catch {
      timerRef.current = setTimeout(triggerRefresh, 60 * 60 * 1000);
    }
  }

  async function triggerRefresh() {
    clearTimer();
    try {
      const res = await fetch('/api/podcasts/refresh', { method: 'POST' });
      const data = await res.json();
      if (data.skipped && data.reason === 'too_soon' && data.nextRefreshIn) {
        timerRef.current = setTimeout(triggerRefresh, data.nextRefreshIn);
      }
      // started or already_running: wait for SSE done:true to reschedule
    } catch {
      scheduleNext();
    }
  }

  useSse((event, data) => {
    if (event !== 'refresh') return;
    const { done } = data as { done: boolean };
    if (done) {
      scheduleNext();
    } else {
      clearTimer();
    }
  });

  useEffect(() => {
    triggerRefresh();
    return clearTimer;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
