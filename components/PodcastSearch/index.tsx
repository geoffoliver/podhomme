'use client';

import { Podcast, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

import type { iTunesResult } from '@/types';
import { usePodcasts } from '@/context/PodcastsContext';

import styles from './index.module.css';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function PodcastSearch({ open, onClose }: Props) {
  const { podcasts, refreshPodcasts } = usePodcasts();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<iTunesResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [subscribing, setSubscribing] = useState<Set<string>>(new Set());
  const [justSubscribed, setJustSubscribed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      dialogRef.current?.showModal();
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      dialogRef.current?.close();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery('');

      setResults([]);

      setJustSubscribed(new Set());
    }
  }, [open]);

  const subscribedUrls = new Set(podcasts.map((p) => p.feedUrl));

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/podcasts/search?q=${encodeURIComponent(q)}`,
      );
      const data = await res.json();
      setResults((data.results as iTunesResult[]).filter((r) => r.feedUrl));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubscribe(result: iTunesResult) {
    setSubscribing((prev) => new Set(prev).add(result.feedUrl));
    try {
      await fetch('/api/podcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedUrl: result.feedUrl }),
      });
      setJustSubscribed((prev) => new Set(prev).add(result.feedUrl));
      refreshPodcasts();
    } finally {
      setSubscribing((prev) => {
        const n = new Set(prev);
        n.delete(result.feedUrl);
        return n;
      });
    }
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onClick={handleBackdropClick}
    >
      <div className={styles.panel}>
        <div className={styles.header}>
          <h2 className={styles.title}>Search Podcasts</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSearch} className={styles.searchForm}>
          <input
            ref={inputRef}
            className="input flex-1"
            type="search"
            placeholder="Search by name or author…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            className="btn-primary"
            type="submit"
            disabled={loading || !query.trim()}
          >
            <Search size={15} />
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>

        <div className={styles.results}>
          {!loading && query && results.length === 0 && (
            <div className={styles.empty}>No results found</div>
          )}
          {results.map((result) => {
            const isSubscribed =
              subscribedUrls.has(result.feedUrl) ||
              justSubscribed.has(result.feedUrl);
            const isSubscribing = subscribing.has(result.feedUrl);
            return (
              <div key={result.collectionId} className={styles.result}>
                {result.artworkUrl100 ? (
                  <Image
                    src={result.artworkUrl100}
                    alt=""
                    width={48}
                    height={48}
                    className={styles.artwork}
                  />
                ) : (
                  <div className={styles.artworkPlaceholder}>
                    <Podcast size={20} />
                  </div>
                )}
                <div className={styles.info}>
                  <span className={styles.name}>{result.collectionName}</span>
                  {result.artistName && (
                    <span className={styles.author}>{result.artistName}</span>
                  )}
                  {result.primaryGenreName && (
                    <span className={styles.genre}>
                      {result.primaryGenreName}
                    </span>
                  )}
                </div>
                <button
                  className={
                    isSubscribed
                      ? 'btn-ghost text-xs shrink-0'
                      : 'btn-primary text-xs shrink-0'
                  }
                  onClick={() => handleSubscribe(result)}
                  disabled={isSubscribed || isSubscribing}
                >
                  {isSubscribing
                    ? 'Subscribing…'
                    : isSubscribed
                      ? 'Subscribed'
                      : 'Subscribe'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </dialog>
  );
}
