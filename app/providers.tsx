'use client'

import { SseProvider } from '@/context/SseContext'
import { PlaybackProvider } from '@/context/PlaybackContext'
import { PodcastsProvider } from '@/context/PodcastsContext'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SseProvider>
      <PlaybackProvider>
        <PodcastsProvider>
          {children}
        </PodcastsProvider>
      </PlaybackProvider>
    </SseProvider>
  )
}
