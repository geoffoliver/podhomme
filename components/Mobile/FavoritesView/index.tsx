'use client';

import {
  CheckCircle,
  MoreVertical,
  Play,
  Podcast,
  Star as StarIcon,
  StarOff,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';

import type { Episode } from '@/types';
import { EpisodeDetail } from '@/components/SplitPane/RightPane/EpisodeDetail';
import { usePlayback } from '@/context/PlaybackContext';
import { useSse } from '@/context/SseContext';

import styles from './index.module.css';

function formatRemaining(
  duration: number | null,
  resumeAt: number,
): string | null {
  if (!duration) return null;
  const secs =
    resumeAt > 0 ? Math.max(0, duration - Math.floor(resumeAt)) : duration;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return resumeAt > 0 ? `${h}h ${m}m left` : `${h}h ${m}m`;
  if (m > 0) return resumeAt > 0 ? `${m}m left` : `${m}m`;
  return null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function FavoritesView() {
  const { loadEpisode } = usePlayback();
  const [episodes, setEpisodes] = useState<
    (Episode & { podcast?: { title: string; imageUrl: string | null } })[]
  >([]);
  const [detailEpisode, setDetailEpisode] = useState<Episode | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);

  const fetchFavorites = useCallback(() => {
    fetch('/api/episodes?favorited=true')
      .then((r) => r.json())
      .then(setEpisodes);
  }, []);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  useSse((event) => {
    if (event === 'episode') fetchFavorites();
  });

  function patchEpisode(id: number, data: object) {
    fetch(`/api/episodes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(fetchFavorites);
  }

  return (
    <div className={styles.view}>
      <div className={styles.header}>
        <h1 className={styles.headerTitle}>Favorites</h1>
        <span className={styles.headerMeta}>
          {episodes.length} episode{episodes.length !== 1 ? 's' : ''}
        </span>
      </div>

      {episodes.length === 0 ? (
        <div className={styles.empty}>
          <StarIcon size={36} />
          <span>No favorites yet</span>
        </div>
      ) : (
        <div className={styles.list}>
          {episodes.map((ep) => {
            const artUrl = ep.imageUrl ?? ep.podcast?.imageUrl ?? null;
            const dur = formatRemaining(ep.duration, ep.resumeAt);
            const menuOpen = menuOpenId === ep.id;
            return (
              <div
                key={ep.id}
                className={`${styles.row} ${ep.played ? styles.rowPlayed : ''}`}
              >
                <button
                  className={styles.rowMain}
                  onClick={() => loadEpisode(ep.id, 'favorites')}
                >
                  {artUrl ? (
                    <Image
                      src={artUrl}
                      alt=""
                      width={52}
                      height={52}
                      className={styles.artwork}
                    />
                  ) : (
                    <div className={styles.artworkPlaceholder}>
                      <Podcast size={22} />
                    </div>
                  )}
                  <div className={styles.info}>
                    <span className={styles.title}>{ep.title}</span>
                    <span className={styles.meta}>
                      {ep.podcast?.title && `${ep.podcast.title} · `}
                      {formatDate(ep.pubDate)}
                      {dur ? ` · ${dur}` : ''}
                    </span>
                  </div>
                  <Play size={18} className={styles.playIcon} />
                </button>

                <div className={styles.menuWrap}>
                  <button
                    className={styles.menuBtn}
                    onClick={() => setMenuOpenId(menuOpen ? null : ep.id)}
                    aria-label="More actions"
                  >
                    <MoreVertical size={18} />
                  </button>
                  {menuOpen && (
                    <>
                      <div
                        className={styles.menuBackdrop}
                        onClick={() => setMenuOpenId(null)}
                      />
                      <div className={styles.menu}>
                        <button
                          className={styles.menuItem}
                          onClick={() => {
                            setDetailEpisode(ep);
                            setMenuOpenId(null);
                          }}
                        >
                          Episode detail
                        </button>
                        <button
                          className={styles.menuItem}
                          onClick={() => {
                            patchEpisode(ep.id, { played: !ep.played });
                            setMenuOpenId(null);
                          }}
                        >
                          <CheckCircle size={15} /> Mark as{' '}
                          {ep.played ? 'unplayed' : 'played'}
                        </button>
                        <button
                          className={styles.menuItem}
                          onClick={() => {
                            patchEpisode(ep.id, { favorited: false });
                            setMenuOpenId(null);
                          }}
                        >
                          <StarOff size={15} /> Unfavorite
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <EpisodeDetail
        episode={detailEpisode}
        onClose={() => setDetailEpisode(null)}
      />
    </div>
  );
}
