'use client';

import {
  ExternalLink, Podcast, RefreshCw, Rss, Trash2, 
} from 'lucide-react';
import {
  useCallback, useEffect, useState, 
} from 'react';
import Image from 'next/image';
import { Virtuoso } from 'react-virtuoso';

import type { Episode, Podcast as PodcastType } from '@/types';
import { EpisodeDetail } from '../EpisodeDetail';
import { EpisodeRow } from '../EpisodeRow';
import { usePodcasts } from '@/context/PodcastsContext';
import { useSse } from '@/context/SseContext';

import styles from './index.module.css';

type Props = {
  podcastId: number;
};

export function PodcastView({ podcastId }: Props) {
  const { setSelectedView, refreshPodcasts } = usePodcasts();
  const [podcast, setPodcast] = useState<PodcastType | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [detailEpisode, setDetailEpisode] = useState<Episode | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fetchPodcast = useCallback(() => {
    fetch(`/api/podcasts/${podcastId}`)
      .then((r) => r.json())
      .then((data: PodcastType & { episodes: Episode[] }) => {
        setPodcast(data);
        const effectiveType = data.typeOverride || data.type;
        const sorted = [...(data.episodes ?? [])].sort((a, b) =>
          effectiveType === 'serial'
            ? new Date(a.pubDate).getTime() - new Date(b.pubDate).getTime()
            : new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime(),
        );
        setEpisodes(sorted);
      });
  }, [podcastId]);

  useEffect(() => {
    fetchPodcast();
  }, [fetchPodcast]);

  useSse((event, data) => {
    if (event === 'episode') {
      const ep = data as Episode;
      if (ep.podcastId === podcastId) {
        setEpisodes((prev) => prev.map((e) => (e.id === ep.id ? ep : e)));
      }
    }
    if (event === 'podcast') {
      const p = data as PodcastType & { deleted?: boolean };
      if (p.id === podcastId && !p.deleted) {
        setPodcast(p);
      }
    }
  });

  async function handleRefresh() {
    setRefreshing(true);
    await fetch(`/api/podcasts/${podcastId}/refresh`, { method: 'POST' });
    fetchPodcast();
    setRefreshing(false);
  }

  async function handleDelete() {
    await fetch(`/api/podcasts/${podcastId}`, { method: 'DELETE' });
    refreshPodcasts();
    setSelectedView('all');
  }

  async function handleTypeOverride(val: string) {
    await fetch(`/api/podcasts/${podcastId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ typeOverride: val || null }),
    });
    fetchPodcast();
  }

  const renderEpisode = useCallback(
    (_: number, ep: Episode) => (
      <EpisodeRow
        episode={ep}
        context="podcast"
        contextPodcastId={podcastId}
        onDetail={setDetailEpisode}
      />
    ),
    [podcastId, setDetailEpisode],
  );

  if (!podcast) return <div className={styles.empty}>Loading…</div>;

  const effectiveType = podcast.typeOverride || podcast.type;

  return (
    <div className={styles.view}>
      <div className={styles.header}>
        {podcast.imageUrl ? (
          <Image
            src={podcast.imageUrl}
            alt=""
            width={96}
            height={96}
            className={styles.artwork}
          />
        ) : (
          <div className={styles.artworkPlaceholder}>
            <Podcast size={32} />
          </div>
        )}
        <div className={styles.headerInfo}>
          <h2 className={styles.podcastTitle}>{podcast.title}</h2>
          {podcast.author && (
            <p className={styles.podcastAuthor}>{podcast.author}</p>
          )}
          {podcast.description && (
            <p
              className={styles.podcastDescription}
              dangerouslySetInnerHTML={{ __html: podcast.description }}
            />
          )}
          <div className={styles.podcastLinks}>
            {podcast.siteUrl && (
              <a
                href={podcast.siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.podcastLink}
              >
                <ExternalLink size={11} /> Website
              </a>
            )}
            <a
              href={podcast.feedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.podcastLink}
            >
              <Rss size={11} /> RSS Feed
            </a>
          </div>
          <div className={styles.headerActions}>
            <button
              className="btn-ghost text-xs"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw
                size={12}
                className={refreshing ? 'animate-spin' : ''}
              />
              Refresh
            </button>
            <select
              className={styles.typeSelect}
              value={podcast.typeOverride ?? ''}
              onChange={(e) => handleTypeOverride(e.target.value)}
              title="Episode order"
            >
              <option value="">Auto ({podcast.type})</option>
              <option value="episodic">Episodic (newest first)</option>
              <option value="serial">Serial (oldest first)</option>
            </select>
            {!confirmDelete ? (
              <button
                className="btn-danger text-xs"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={12} /> Unsubscribe
              </button>
            ) : (
              <div className="flex gap-1 items-center">
                <span className="text-xs text-red-600">Are you sure?</span>
                <button className="btn-danger text-xs" onClick={handleDelete}>
                  Yes, delete
                </button>
                <button
                  className="btn-ghost text-xs"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <span className={styles.toolbarTitle}>
          {episodes.length} episode{episodes.length !== 1 ? 's' : ''}
          {' · '}
          {effectiveType === 'serial' ? 'oldest first' : 'newest first'}
        </span>
      </div>

      {episodes.length === 0 ? (
        <div className={styles.empty}>No episodes</div>
      ) : (
        <Virtuoso
          className={styles.episodeList}
          data={episodes}
          itemContent={renderEpisode}
        />
      )}

      <EpisodeDetail
        episode={detailEpisode}
        onClose={() => setDetailEpisode(null)}
      />
    </div>
  );
}
