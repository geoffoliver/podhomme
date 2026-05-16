'use client';

import {
  ChevronDown,
  ChevronFirst,
  ChevronLast,
  Headphones,
  Maximize2,
  Monitor,
  Pause,
  Play,
  Podcast,
  SkipBack,
  SkipForward,
  Star,
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
  open: boolean
  onClose: () => void
}

export function NowPlaying({ open, onClose }: Props) {
  const {
 state, isVideo, registerVideoElement, audioDetached, joinAudio, play, pause, seek, next, prev, currentPosition, toggleFavorite,
} = usePlayback();
  const { episode } = state;
  const [displayPos, setDisplayPos] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);

  const videoRefCallback = useCallback((el: HTMLVideoElement | null) => {
    videoElRef.current = el;
    registerVideoElement(el);
  }, [registerVideoElement]);

  const handleFullscreen = () => videoElRef.current?.requestFullscreen();

  useEffect(() => {
    function tick() {
      if (!seeking) setDisplayPos(currentPosition());
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [currentPosition, seeking]);

  // Close overlay if episode disappears while open
  useEffect(() => {
    if (open && !episode) onClose();
  }, [open, episode, onClose]);

  const duration = episode?.duration ?? 0;
  const artUrl = episode?.imageUrl ?? episode?.podcast?.imageUrl ?? null;
  const sliderValue = seeking ? seekValue : displayPos;

  return (
    // Always mounted — visibility:hidden keeps the video element alive when closed
    <div className={`${styles.overlay} ${!open ? styles.overlayClosed : ''} ${isVideo ? styles.overlayVideo : ''}`}>
      <div className={styles.topBar}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close now playing">
          <ChevronDown size={26} />
        </button>
        <span className={styles.heading}>Now Playing</span>
        {isVideo ? (
          <button className={styles.fullscreenBtn} onClick={handleFullscreen} aria-label="Fullscreen">
            <Maximize2 size={20} />
          </button>
        ) : (
          <div className={styles.topBarSpacer} />
        )}
      </div>

      {/* Video element — always mounted so PlaybackContext can control it */}
      <div className={`${styles.videoWrap} ${!isVideo ? styles.videoWrapHidden : ''}`}>
        <video ref={videoRefCallback} className={styles.video} />
      </div>

      {/* Artwork — shown only for audio episodes */}
      {!isVideo && (
        <div className={styles.artworkWrap}>
          {artUrl ? (
            <Image
              src={artUrl}
              alt=""
              width={300}
              height={300}
              className={`${styles.artwork} ${state.isPlaying ? styles.artworkPlaying : ''}`}
            />
          ) : (
            <div className={styles.artworkPlaceholder}><Podcast size={80} /></div>
          )}
        </div>
      )}

      <div className={styles.meta}>
        <span className={styles.episodeTitle}>{episode?.title ?? ''}</span>
        <span className={styles.podcastTitle}>{episode?.podcast?.title ?? ''}</span>
      </div>

      <div className={styles.seekArea}>
        <input
          type="range"
          className={styles.seekSlider}
          min={0}
          max={Math.max(1, duration)}
          step={1}
          value={sliderValue}
          onChange={e => { setSeeking(true); setSeekValue(Number(e.target.value)); }}
          onMouseUp={e => { seek(Number((e.target as HTMLInputElement).value)); setSeeking(false); }}
          onTouchEnd={e => { seek(Number((e.currentTarget as HTMLInputElement).value)); setSeeking(false); }}
          aria-label="Playback position"
        />
        <div className={styles.times}>
          <span>{formatTime(sliderValue)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className={styles.transport}>
        <button className={styles.transportBtn} onClick={prev} aria-label="Previous episode">
          <ChevronFirst size={26} />
        </button>
        <button className={styles.transportBtn} onClick={() => seek(Math.max(0, displayPos - 15))} aria-label="Skip back 15 seconds">
          <SkipBack size={26} />
        </button>
        <button className={styles.playBtn} onClick={state.isPlaying ? pause : play} aria-label={state.isPlaying ? 'Pause' : 'Play'}>
          {state.isPlaying ? <Pause size={30} /> : <Play size={30} />}
        </button>
        <button className={styles.transportBtn} onClick={() => seek(displayPos + 30)} aria-label="Skip forward 30 seconds">
          <SkipForward size={26} />
        </button>
        <button className={styles.transportBtn} onClick={next} aria-label="Next episode">
          <ChevronLast size={26} />
        </button>
      </div>

      <div className={styles.footer}>
        {audioDetached && (
          <button className={styles.tapToHear} onClick={joinAudio}>
            <Headphones size={15} /> Tap to hear
          </button>
        )}
        <button
          className={`${styles.favoriteBtn} ${episode?.favorited ? styles.favoriteBtnActive : ''}`}
          onClick={toggleFavorite}
          aria-label={episode?.favorited ? 'Unfavorite' : 'Favorite'}
        >
          <Star size={22} fill={episode?.favorited ? 'currentColor' : 'none'} />
        </button>
        <a href="/api/view?mode=desktop" className={styles.switchLink}>
          <Monitor size={14} /> Desktop view
        </a>
      </div>
    </div>
  );
}
