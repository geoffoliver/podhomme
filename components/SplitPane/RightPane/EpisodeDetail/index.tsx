'use client';

import { useEffect, useRef } from 'react';
import type { Episode } from '@/types';
import Image from 'next/image';
import { Podcast } from 'lucide-react';

import styles from './index.module.css';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDuration(seconds: number | null) {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

type Props = {
  episode: Episode | null;
  onClose: () => void;
};

export function EpisodeDetail({ episode, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (episode) {
      el.showModal();
      // Scroll description to top when opening new episode
      if (descriptionRef.current) descriptionRef.current.scrollTop = 0;
    } else {
      el.close();
    }
  }, [episode]);

  // Close on backdrop click
  function handleClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) onClose();
  }

  if (!episode) return <dialog ref={dialogRef} />;

  const artUrl = episode.imageUrl ?? episode.podcast?.imageUrl ?? null;

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onClose={onClose}
      onClick={handleClick}
    >
      <div className={styles.header}>
        {artUrl ? (
          <Image
            src={artUrl}
            alt=""
            width={80}
            height={80}
            className={styles.artwork}
          />
        ) : (
          <div className={styles.artworkPlaceholder}>
            <Podcast size={32} />
          </div>
        )}
        <div className={styles.headerInfo}>
          <h2 className={styles.title}>{episode.title}</h2>
          {episode.podcast?.title && (
            <p className={styles.podcast}>{episode.podcast.title}</p>
          )}
          <div className={styles.meta}>
            <span>{formatDate(episode.pubDate)}</span>
            {episode.duration && (
              <span>{formatDuration(episode.duration)}</span>
            )}
          </div>
        </div>
      </div>

      {episode.description && (
        <div
          className={styles.body}
          dangerouslySetInnerHTML={{ __html: episode.description }}
          ref={descriptionRef}
        />
      )}

      <div className={styles.footer}>
        <button className="btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </dialog>
  );
}
