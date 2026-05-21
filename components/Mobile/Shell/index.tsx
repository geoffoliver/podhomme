'use client';

import {
  useEffect, useRef, useState, 
} from 'react';
import { BottomTabs } from '../BottomTabs';
import { ChatView } from '../ChatView';
import { FavoritesView } from '../FavoritesView';
import { LibraryView } from '../LibraryView';
import { MiniPlayer } from '../MiniPlayer';
import { NowPlaying } from '../NowPlaying';
import { QueueView } from '../QueueView';
import { usePlayback } from '@/context/PlaybackContext';

import styles from './index.module.css';

export type MobileTab = 'queue' | 'library' | 'favorites' | 'chat';

export function MobileShell() {
  const [tab, setTab] = useState<MobileTab>('queue');
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false);
  const [unreadChat, setUnreadChat] = useState(false);
  const tabRef = useRef(tab);
  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);
  const { state } = usePlayback();

  useEffect(() => {
    const source = new EventSource('/api/events');
    source.addEventListener('chat', () => {
      if (tabRef.current !== 'chat') setUnreadChat(true);
    });
    return () => source.close();
  }, []);

  function switchTab(next: MobileTab) {
    setTab(next);
    if (next === 'chat') setUnreadChat(false);
  }

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
        {tab === 'queue' && <QueueView />}
        {tab === 'library' && <LibraryView />}
        {tab === 'favorites' && <FavoritesView />}
        {tab === 'chat' && <ChatView />}
      </div>

      {state.episodeId && <MiniPlayer onTap={() => setNowPlayingOpen(true)} />}

      <BottomTabs tab={tab} onTab={switchTab} unreadChat={unreadChat} />

      <NowPlaying
        open={nowPlayingOpen}
        onClose={() => setNowPlayingOpen(false)}
      />
    </div>
  );
}
