'use client';

import { Plus, Podcast, RefreshCw, Search, Star } from 'lucide-react';
import { useState } from 'react';
import Image from 'next/image';

import { PodcastSearch } from '@/components/PodcastSearch';
import type { SelectedView } from '@/types';
import { usePodcasts } from '@/context/PodcastsContext';

import styles from './index.module.css';

export function LeftPane() {
  const {
    podcasts,
    selectedView,
    setSelectedView,
    refreshStatus,
    refreshPodcasts,
  } = usePodcasts();
  const [adding, setAdding] = useState(false);
  const [searching, setSearching] = useState(false);
  const [feedUrl, setFeedUrl] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const items: {
    view: SelectedView;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    {
      view: 'all',
      label: 'All Podcasts',
      icon: <Podcast size={14} />,
    },
    {
      view: 'favorites',
      label: 'Favorites',
      icon: <Star size={14} />,
    },
  ];

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    const url = feedUrl.trim();
    if (!url) return;
    const res = await fetch('/api/podcasts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedUrl: url }),
    });
    if (res.ok) {
      setFeedUrl('');
      setAdding(false);
      refreshPodcasts();
    } else {
      const body = await res.json();
      setAddError(body.error ?? 'Failed to add podcast');
    }
  }

  async function handleRefreshAll() {
    setRefreshing(true);
    await fetch('/api/podcasts/refresh?force=true', { method: 'POST' });
    setRefreshing(false);
  }

  return (
    <nav className={styles.pane}>
      <ul className={styles.list} role="listbox" aria-label="Podcast library">
        {items.map(({ view, label, icon }) => (
          <li key={String(view)}>
            <button
              className={`${styles.item} ${selectedView === view ? styles.itemActive : ''}`}
              onClick={() => setSelectedView(view)}
              role="option"
              aria-selected={selectedView === view}
            >
              <span className={styles.artworkPlaceholder}>{icon}</span>
              <span className={styles.label}>{label}</span>
            </button>
          </li>
        ))}

        <li>
          <div className={styles.divider} role="separator" />
        </li>

        {podcasts.map((p) => (
          <li key={p.id}>
            <button
              className={`${styles.item} ${selectedView === p.id ? styles.itemActive : ''}`}
              onClick={() => setSelectedView(p.id)}
              role="option"
              aria-selected={selectedView === p.id}
            >
              {p.imageUrl ? (
                <Image
                  src={p.imageUrl!}
                  alt=""
                  width={28}
                  height={28}
                  className={styles.artwork}
                />
              ) : (
                <span className={styles.artworkPlaceholder}>
                  <Podcast size={14} />
                </span>
              )}
              <span className={styles.label}>{p.title}</span>
              {p._count && p._count.episodes > 0 && (
                <span className={styles.badge}>{p._count.episodes}</span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {/* Add podcast inline form */}
      {adding && (
        <form
          onSubmit={handleAdd}
          className="px-2 py-2 border-t border-neutral-200 flex flex-col gap-1.5"
        >
          <input
            className="input"
            type="url"
            placeholder="RSS feed URL"
            value={feedUrl}
            onChange={(e) => setFeedUrl(e.target.value)}
            autoFocus
          />
          {addError && <p className="text-xs text-red-600">{addError}</p>}
          <div className="flex gap-1">
            <button type="submit" className="btn-primary flex-1 text-xs">
              Add
            </button>
            <button
              type="button"
              className="btn-ghost flex-1 text-xs"
              onClick={() => {
                setAdding(false);
                setAddError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Refresh status bar */}
      {refreshStatus && !refreshStatus.done && (
        <div className={styles.statusBar}>
          Refreshing &ldquo;{refreshStatus.podcastTitle}&rdquo; (
          {refreshStatus.current} of {refreshStatus.total})
        </div>
      )}

      {/* Button bar */}
      <div className={styles.buttonBar}>
        <button
          className="btn-ghost text-xs gap-1"
          onClick={() => {
            setAdding((v) => !v);
            setAddError(null);
          }}
          title="Add podcast by URL"
          aria-label="Add podcast by URL"
        >
          <Plus size={14} />
        </button>
        <button
          className="btn-ghost text-xs gap-1"
          onClick={() => setSearching(true)}
          title="Search for podcasts"
          aria-label="Search for podcasts"
        >
          <Search size={14} />
        </button>
        <button
          className="btn-ghost text-xs gap-1 ml-auto"
          onClick={handleRefreshAll}
          disabled={refreshing || !!refreshStatus}
          title="Refresh all feeds"
          aria-label="Refresh all feeds"
        >
          <RefreshCw
            size={14}
            className={refreshing || !!refreshStatus ? 'animate-spin' : ''}
          />
        </button>
      </div>

      <PodcastSearch open={searching} onClose={() => setSearching(false)} />
    </nav>
  );
}
