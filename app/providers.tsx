'use client';

import { PlaybackProvider } from '@/context/PlaybackContext';
import { PodcastsProvider } from '@/context/PodcastsContext';
import { SseProvider } from '@/context/SseContext';
import { useEffect } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    }
  }, []);

  return (
    <SseProvider>
      <PlaybackProvider>
        <PodcastsProvider>
          {children}
        </PodcastsProvider>
      </PlaybackProvider>
    </SseProvider>
  );
}
