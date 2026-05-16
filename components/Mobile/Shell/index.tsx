'use client';

import { useEffect, useState } from 'react';
import { BottomTabs } from '../BottomTabs';
import { FavoritesView } from '../FavoritesView';
import { LibraryView } from '../LibraryView';
import { MiniPlayer } from '../MiniPlayer';
import { NowPlaying } from '../NowPlaying';
import { QueueView } from '../QueueView';
import { usePlayback } from '@/context/PlaybackContext';

import styles from './index.module.css';

export type MobileTab = 'queue' | 'library' | 'favorites'

export function MobileShell() {
  const [tab, setTab] = useState<MobileTab>('queue');
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false);
  const { state } = usePlayback();

  useEffect(() => {
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prev;
      document.body.style.overflow = '';
    };
  }, []);

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

      <NowPlaying open={nowPlayingOpen} onClose={() => setNowPlayingOpen(false)} />
    </div>
  );
}
