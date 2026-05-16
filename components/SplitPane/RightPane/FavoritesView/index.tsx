'use client';

import {
  useCallback, useEffect, useState,
} from 'react';
import { Star } from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';

import type { Episode } from '@/types';
import { EpisodeDetail } from '../EpisodeDetail';
import { EpisodeRow } from '../EpisodeRow';
import { useSse } from '@/context/SseContext';

import styles from './index.module.css';

export function FavoritesView() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [detailEpisode, setDetailEpisode] = useState<Episode | null>(null);

  function fetchFavorites() {
    fetch('/api/episodes?favorited=true')
      .then(r => r.json())
      .then((data: Episode[]) =>
        setEpisodes(data.sort((a, b) => {
          const ta = a.favoritedAt ? new Date(a.favoritedAt).getTime() : 0;
          const tb = b.favoritedAt ? new Date(b.favoritedAt).getTime() : 0;
          return tb - ta;
        })),
      );
  }

  useEffect(() => { fetchFavorites(); }, []);

  useSse((event, data) => {
    if (event === 'episode') {
      const ep = data as Episode;
      setEpisodes(prev => {
        const filtered = prev.filter(e => e.id !== ep.id);
        if (!ep.favorited) return filtered;
        return [ep, ...filtered].sort((a, b) => {
          const ta = a.favoritedAt ? new Date(a.favoritedAt).getTime() : 0;
          const tb = b.favoritedAt ? new Date(b.favoritedAt).getTime() : 0;
          return tb - ta;
        });
      });
    }
  });

  const renderEpisode = useCallback((_: number, ep: Episode) => (
    <EpisodeRow episode={ep} context="favorites" onDetail={setDetailEpisode} />
  ), [setDetailEpisode]);

  return (
    <div className={styles.view}>
      <div className={styles.toolbar}>
        <span className={styles.toolbarTitle}>Favorites ({episodes.length})</span>
      </div>

      {episodes.length === 0 ? (
        <div className={styles.empty}>
          <Star size={32} />
          <span>No favorited episodes yet</span>
        </div>
      ) : (
        <Virtuoso
          className={styles.episodeList}
          data={episodes}
          itemContent={renderEpisode}
        />
      )}

      <EpisodeDetail episode={detailEpisode} onClose={() => setDetailEpisode(null)} />
    </div>
  );
}
