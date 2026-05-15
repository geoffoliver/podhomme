'use client'

import { useEffect } from 'react'
import { SseProvider } from '@/context/SseContext'
import { PlaybackProvider } from '@/context/PlaybackContext'
import { PodcastsProvider } from '@/context/PodcastsContext'

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
    }
  }, [])

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
