'use client';

import {
  Headphones, Pause, Play, Podcast, SkipForward, 
} from 'lucide-react';
import {
  useEffect, useRef, useState, 
} from 'react';
import Image from 'next/image';

import { usePlayback } from '@/context/PlaybackContext';

import styles from './index.module.css';

type Props = {
  onTap: () => void;
};

export function MiniPlayer({ onTap }: Props) {
  const {
    state,
    audioDetached,
    mediaDuration,
    joinAudio,
    play,
    pause,
    seek,
    currentPosition,
  } = usePlayback();
  const { episode } = state;
  const [displayPos, setDisplayPos] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    function tick() {
      setDisplayPos(currentPosition());
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [currentPosition]);

  if (!episode) return null;

  const duration = mediaDuration || episode.duration || 0;
  const progress = duration > 0 ? Math.min(displayPos / duration, 1) : 0;
  const artUrl = episode.imageUrl ?? episode.podcast?.imageUrl ?? null;

  return (
    <div className={styles.player}>
      <button
        className={styles.infoArea}
        onClick={onTap}
        aria-label="Open now playing"
      >
        {artUrl ? (
          <Image
            src={artUrl}
            alt=""
            width={44}
            height={44}
            className={styles.artwork}
          />
        ) : (
          <div className={styles.artworkPlaceholder}>
            <Podcast size={18} />
          </div>
        )}
        <div className={styles.info}>
          <span className={styles.title}>{episode.title}</span>
          <span className={styles.podcast}>{episode.podcast?.title ?? ''}</span>
        </div>
      </button>

      <div className={styles.controls}>
        {audioDetached ? (
          <button
            className={styles.controlBtn}
            onClick={joinAudio}
            aria-label="Tap to listen"
          >
            <Headphones size={22} />
          </button>
        ) : (
          <button
            className={styles.controlBtn}
            onClick={state.isPlaying ? pause : play}
            aria-label={state.isPlaying ? 'Pause' : 'Play'}
          >
            {state.isPlaying ? <Pause size={22} /> : <Play size={22} />}
          </button>
        )}
        <button
          className={styles.controlBtn}
          onClick={() => seek(displayPos + 30)}
          aria-label="Skip forward 30 seconds"
        >
          <SkipForward size={22} />
        </button>
      </div>

      <div className={styles.progressTrack}>
        <div
          className={styles.progressFill}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}
