'use client'

import { useState } from 'react'
import { BottomTabs } from '../BottomTabs'
import { MiniPlayer } from '../MiniPlayer'
import { NowPlaying } from '../NowPlaying'
import { QueueView } from '../QueueView'
import { LibraryView } from '../LibraryView'
import { FavoritesView } from '../FavoritesView'
import { usePlayback } from '@/context/PlaybackContext'
import styles from './index.module.css'

export type MobileTab = 'queue' | 'library' | 'favorites'

export function MobileShell() {
  const [tab, setTab] = useState<MobileTab>('queue')
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false)
  const { state } = usePlayback()

  return (
    <div className={styles.shell}>
      <div className={styles.content}>
        {tab === 'queue'     && <QueueView />}
        {tab === 'library'   && <LibraryView />}
        {tab === 'favorites' && <FavoritesView />}
      </div>

      {state.episodeId && (
        <MiniPlayer onTap={() => setNowPlayingOpen(true)} />
      )}

      <BottomTabs tab={tab} onTab={setTab} />

      {nowPlayingOpen && (
        <NowPlaying onClose={() => setNowPlayingOpen(false)} />
      )}
    </div>
  )
}
