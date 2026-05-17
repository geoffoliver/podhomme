'use client';

import {
  ChevronFirst,
  ChevronLast,
  Headphones,
  MessageSquare,
  Pause,
  Play,
  Podcast,
  Settings,
  SkipBack,
  SkipForward,
  Smartphone,
} from 'lucide-react';
import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import Image from 'next/image';
import { usePlayback } from '@/context/PlaybackContext';

import styles from './index.module.css';

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

type Props = {
  onSettingsClick: () => void
  onChatClick: () => void
  chatOpen: boolean
}

export function TopBar({ onSettingsClick, onChatClick, chatOpen }: Props) {
  const {
 state, audioDetached, joinAudio, play, pause, seek, next, prev, currentPosition,
} = usePlayback();
  const { episode } = state;
  const [displayPos, setDisplayPos] = useState(0);
  const rafRef = useRef<number | null>(null);
  const seekingRef = useRef(false);

  // Animate position display
  useEffect(() => {
    function tick() {
      if (!seekingRef.current) setDisplayPos(currentPosition());
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [currentPosition]);

  const duration = episode?.duration ?? 0;
  const progress = duration > 0 ? Math.min(displayPos / duration, 1) : 0;

  const handleBarClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    seek(ratio * duration);
  }, [duration, seek]);

  const handleBarMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    seekingRef.current = true;
    const bar = e.currentTarget;
    const duration_ = duration;

    function onMove(ev: MouseEvent) {
      const rect = bar.getBoundingClientRect();
      const ratio = Math.min(Math.max((ev.clientX - rect.left) / rect.width, 0), 1);
      setDisplayPos(ratio * duration_);
    }
    function onUp(ev: MouseEvent) {
      seekingRef.current = false;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.min(Math.max((ev.clientX - rect.left) / rect.width, 0), 1);
      seek(ratio * duration_);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [duration, seek]);

  const artUrl = episode?.imageUrl ?? episode?.podcast.imageUrl ?? null;

  return (
    <header className={styles.topbar}>
      {/* Album art */}
      {artUrl ? (
        <Image src={artUrl} alt="" width={40} height={40} className={styles.artwork} data-podhomme="artwork" />
      ) : (
        <div className={styles.artworkPlaceholder}>
          <Podcast size={20} />
        </div>
      )}

      {/* Now playing info */}
      <div className={styles.nowPlaying}>
        <span className={styles.episodeTitle} data-podhomme="episode-title">
          {episode?.title ?? 'Nothing playing'}
        </span>
        <span className={styles.podcastTitle} data-podhomme="podcast-title">
          {episode?.podcast.title ?? ''}
        </span>
      </div>

      {/* Transport controls */}
      <div className={styles.transport}>
        <button className="btn-icon" onClick={prev} title="Previous episode" aria-label="Previous episode">
          <ChevronFirst size={18} />
        </button>
        <button className="btn-icon" onClick={() => seek(Math.max(0, displayPos - 15))} title="Skip back 15s" aria-label="Skip back 15 seconds">
          <SkipBack size={18} />
        </button>
        <button
          className="btn-primary rounded-full w-9 h-9 p-0"
          onClick={state.isPlaying ? pause : play}
          aria-label={state.isPlaying ? 'Pause' : 'Play'}
          disabled={!state.episodeId}

          // @ts-expect-error
          autoComplete="off"
        >
          {state.isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button className="btn-icon" onClick={() => seek(displayPos + 30)} title="Skip forward 30s" aria-label="Skip forward 30 seconds">
          <SkipForward size={18} />
        </button>
        <button className="btn-icon" onClick={next} title="Next episode" aria-label="Next episode">
          <ChevronLast size={18} />
        </button>
      </div>

      {/* Progress bar */}
      <div className={styles.progress}>
        <span className={styles.time}>{formatTime(displayPos)}</span>
        <div
          className={styles.progressBar}
          onClick={handleBarClick}
          onMouseDown={handleBarMouseDown}
          role="slider"
          aria-label="Playback position"
          aria-valuenow={Math.floor(displayPos)}
          aria-valuemin={0}
          aria-valuemax={duration}
        >
          <div className={styles.progressFill} style={{ width: `${progress * 100}%` }} />
        </div>
        <span className={styles.time}>{formatTime(duration)}</span>
      </div>

      {/* Join audio prompt */}
      {audioDetached && (
        <button
          className={styles.joinBtn}
          onClick={joinAudio}
          title="Audio is playing — click to hear it on this device"
        >
          <Headphones size={15} />
          Tap to hear
        </button>
      )}

      {/* Switch to mobile view */}
      <a href="/api/view?mode=mobile" className="btn-icon" title="Switch to mobile view" aria-label="Switch to mobile view">
        <Smartphone size={18} />
      </a>

      {/* Chat */}
      <button
        className={`btn-icon ${chatOpen ? styles.activeIcon : ''}`}
        onClick={onChatClick}
        title="Chat"
        aria-label="Chat"
        aria-pressed={chatOpen}
      >
        <MessageSquare size={18} />
      </button>

      {/* Settings */}
      <button className="btn-icon" onClick={onSettingsClick} title="Settings" aria-label="Settings">
        <Settings size={18} />
      </button>
    </header>
  );
}
