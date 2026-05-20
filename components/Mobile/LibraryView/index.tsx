'use client';

import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Play,
  Podcast,
  RefreshCw,
  Star,
  StarOff,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import Image from 'next/image';

import type { Episode, Podcast as PodcastType } from '@/types';
import { EpisodeDetail } from '@/components/SplitPane/RightPane/EpisodeDetail';
import { usePlayback } from '@/context/PlaybackContext';
import { usePodcasts } from '@/context/PodcastsContext';

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

export function LibraryView() {
  const { podcasts } = usePodcasts();
  const { loadEpisode } = usePlayback();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [podcast, setPodcast] = useState<
    (PodcastType & { episodes: Episode[] }) | null
  >(null);
  const [refreshing, setRefreshing] = useState(false);
  const [detailEpisode, setDetailEpisode] = useState<Episode | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);

  useEffect(() => {
    if (selectedId == null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPodcast(null);
      return;
    }
    fetch(`/api/podcasts/${selectedId}`)
      .then((r) => r.json())
      .then((data) => setPodcast(data));
  }, [selectedId]);

  async function handleRefresh() {
    if (!selectedId) return;
    setRefreshing(true);
    await fetch(`/api/podcasts/${selectedId}/refresh`, { method: 'POST' });
    const data = await fetch(`/api/podcasts/${selectedId}`).then((r) =>
      r.json(),
    );
    setPodcast(data);
    setRefreshing(false);
  }

  function patchEpisode(id: number, data: object) {
    fetch(`/api/episodes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(() => {
      if (selectedId)
        fetch(`/api/podcasts/${selectedId}`)
          .then((r) => r.json())
          .then(setPodcast);
    });
  }

  // Podcast list
  if (selectedId == null) {
    return (
      <div className={styles.view}>
        <div className={styles.header}>
          <h1 className={styles.headerTitle}>Library</h1>
          <span className={styles.headerMeta}>
            {podcasts.length} podcast{podcasts.length !== 1 ? 's' : ''}
          </span>
        </div>
        {podcasts.length === 0 ? (
          <div className={styles.empty}>
            <Podcast size={36} />
            <span>No podcasts yet</span>
          </div>
        ) : (
          <div className={styles.list}>
            {podcasts.map((p) => (
              <button
                key={p.id}
                className={styles.podcastRow}
                onClick={() => setSelectedId(p.id)}
              >
                {p.imageUrl ? (
                  <Image
                    src={p.imageUrl}
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
                <div className={styles.podcastInfo}>
                  <span className={styles.podcastTitle}>{p.title}</span>
                  {p.author && (
                    <span className={styles.podcastAuthor}>{p.author}</span>
                  )}
                </div>
                {p._count && p._count.episodes > 0 && (
                  <span className={styles.badge}>{p._count.episodes}</span>
                )}
                <ChevronRight size={16} className={styles.chevron} />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Podcast episode list
  const effectiveType = podcast?.typeOverride || podcast?.type;
  const episodes = podcast
    ? [...podcast.episodes].sort((a, b) =>
        effectiveType === 'serial'
          ? new Date(a.pubDate).getTime() - new Date(b.pubDate).getTime()
          : new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime(),
      )
    : [];

  return (
    <div className={styles.view}>
      <div className={styles.podcastHeader}>
        <button
          className={styles.backBtn}
          onClick={() => setSelectedId(null)}
          aria-label="Back to library"
        >
          <ChevronLeft size={22} />
        </button>
        {podcast ? (
          <>
            {podcast.imageUrl ? (
              <Image
                src={podcast.imageUrl}
                alt=""
                width={44}
                height={44}
                className={styles.headerArtwork}
              />
            ) : (
              <div className={styles.headerArtworkPlaceholder}>
                <Podcast size={20} />
              </div>
            )}
            <span className={styles.podcastHeaderTitle}>{podcast.title}</span>
            <button
              className={styles.refreshBtn}
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="Refresh feed"
            >
              <RefreshCw
                size={16}
                className={refreshing ? 'animate-spin' : ''}
              />
            </button>
          </>
        ) : (
          <span className={styles.podcastHeaderTitle}>Loading…</span>
        )}
      </div>

      <div className={styles.list}>
        {episodes.map((ep) => {
          const artUrl = ep.imageUrl ?? podcast?.imageUrl ?? null;
          const dur = formatRemaining(ep.duration, ep.resumeAt);
          const menuOpen = menuOpenId === ep.id;
          return (
            <div
              key={ep.id}
              className={`${styles.episodeRow} ${ep.played ? styles.episodeRowPlayed : ''}`}
            >
              <button
                className={styles.episodeMain}
                onClick={() => loadEpisode(ep.id, 'podcast', selectedId)}
              >
                {artUrl ? (
                  <Image
                    src={artUrl}
                    alt=""
                    width={48}
                    height={48}
                    className={styles.episodeArtwork}
                  />
                ) : (
                  <div className={styles.episodeArtworkPlaceholder}>
                    <Podcast size={18} />
                  </div>
                )}
                <div className={styles.episodeInfo}>
                  <span className={styles.episodeTitle}>{ep.title}</span>
                  <span className={styles.episodeMeta}>
                    {formatDate(ep.pubDate)}
                    {dur ? ` · ${dur}` : ''}
                  </span>
                </div>
                <Play size={16} className={styles.playIcon} />
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
                          patchEpisode(ep.id, { favorited: !ep.favorited });
                          setMenuOpenId(null);
                        }}
                      >
                        {ep.favorited ? (
                          <>
                            <StarOff size={15} /> Unfavorite
                          </>
                        ) : (
                          <>
                            <Star size={15} /> Favorite
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <EpisodeDetail
        episode={detailEpisode}
        onClose={() => setDetailEpisode(null)}
      />
    </div>
  );
}
