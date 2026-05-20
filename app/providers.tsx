'use client';

import { PlaybackProvider } from '@/context/PlaybackContext';
import { PodcastsProvider } from '@/context/PodcastsContext';
import { SseProvider } from '@/context/SseContext';
import { useRefreshScheduler } from '@/hooks/useRefreshScheduler';
import { useEffect } from 'react';

function RefreshScheduler() {
  useRefreshScheduler();
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch(() => {});
    }
  }, []);

  return (
    <SseProvider>
      <RefreshScheduler />
      <PlaybackProvider>
        <PodcastsProvider>{children}</PodcastsProvider>
      </PlaybackProvider>
    </SseProvider>
  );
}
