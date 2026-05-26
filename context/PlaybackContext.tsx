'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import type { PlaybackStateData } from '@/types';
import { useSse } from './SseContext';

type Action = { type: 'SET'; payload: PlaybackStateData };

const defaultState: PlaybackStateData = {
  id: 1,
  episodeId: null,
  position: 0,
  isPlaying: false,
  context: 'all',
  contextPodcastId: null,
  updatedAt: new Date().toISOString(),
  episode: null,
};

function reducer(state: PlaybackStateData, action: Action): PlaybackStateData {
  if (action.type === 'SET') return action.payload;
  return state;
}

type Ctx = {
  state: PlaybackStateData;
  isVideo: boolean;
  audioDetached: boolean;
  mediaDuration: number;
  joinAudio: () => void;
  registerVideoElement: (el: HTMLVideoElement | null) => void;
  currentPosition: () => number;
  play: () => void;
  pause: () => void;
  seek: (pos: number) => void;
  next: () => void;
  prev: () => void;
  loadEpisode: (
    id: number,
    context: PlaybackStateData['context'],
    podcastId?: number,
  ) => void;
  toggleFavorite: () => void;
};

export const PlaybackContext = createContext<Ctx | null>(null);

export function PlaybackProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, defaultState);
  const [audioDetached, setAudioDetached] = useState(false);
  const [mediaDuration, setMediaDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const isVideoRef = useRef(false);
  const syncRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevEpisodeIdRef = useRef<number | null>(null);

  // Derived — kept in a ref so callbacks can read it without stale closures
  const isVideo = state.episode?.mediaType === 'video';
  useEffect(() => {
    isVideoRef.current = isVideo;
  });

  const getMediaEl = (): HTMLMediaElement | null =>
    isVideoRef.current ? videoElementRef.current : audioRef.current;

  const registerVideoElement = useCallback((el: HTMLVideoElement | null) => {
    videoElementRef.current = el;
  }, []);

  // Load initial state
  useEffect(() => {
    fetch('/api/playback')
      .then((r) => r.json())
      .then((data: PlaybackStateData) => {
        dispatch({ type: 'SET', payload: data });
        prevEpisodeIdRef.current = data.episodeId;
        const isVid = data.episode?.mediaType === 'video';
        const media = isVid ? videoElementRef.current : audioRef.current;
        if (media && data.episode) {
          media.src = `/api/episodes/${data.episodeId}/audio`;
          media.currentTime = data.position;
          if (data.isPlaying) {
            // Muted autoplay is allowed by all browsers; user taps to unmute
            media.muted = true;
            media.play().catch(() => {});
            setAudioDetached(true);
          }
        }
      });
  }, []);

  const applyStateToMedia = useCallback((data: PlaybackStateData) => {
    const isVid = data.episode?.mediaType === 'video';
    const media: HTMLMediaElement | null = isVid
      ? videoElementRef.current
      : audioRef.current;
    if (!media) return;

    if (!data.isPlaying) setAudioDetached(false);

    if (data.episodeId !== prevEpisodeIdRef.current) {
      prevEpisodeIdRef.current = data.episodeId;
      if (data.episode) {
        // Clear the other element when switching media type
        const other: HTMLMediaElement | null = isVid
          ? audioRef.current
          : videoElementRef.current;
        if (other) {
          other.pause();
          other.src = '';
        }
        media.src = `/api/episodes/${data.episodeId}/audio`;
        media.currentTime = data.position;
        if (data.isPlaying) media.play().catch(() => {});
      } else {
        media.pause();
        media.src = '';
      }
    } else {
      if (data.isPlaying && media.paused) {
        media.play().catch(() => {});
      } else if (!data.isPlaying && !media.paused) {
        media.pause();
      }
      // Correct significant drift (seek from another client)
      const expected = data.isPlaying
        ? data.position +
          (Date.now() - new Date(data.updatedAt).getTime()) / 1000
        : data.position;
      if (Math.abs(media.currentTime - expected) > 5) {
        media.currentTime = Math.max(0, expected);
      }
    }
  }, []);

  useSse((event, data) => {
    if (event === 'playback') {
      const payload = data as PlaybackStateData;
      dispatch({ type: 'SET', payload });
      applyStateToMedia(payload);
    }
  });

  // 5s position heartbeat while playing
  useEffect(() => {
    if (state.isPlaying) {
      syncRef.current = setInterval(() => {
        const pos = getMediaEl()?.currentTime;
        if (pos !== undefined) {
          fetch('/api/playback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'sync', position: pos }),
          }).catch(() => {});
        }
      }, 5000);
    }
    return () => {
      if (syncRef.current) clearInterval(syncRef.current);
    };
  }, [state.isPlaying]);

  const post = useCallback(
    (body: object) =>
      fetch('/api/playback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
        .then((r) => r.json())
        .then((data: PlaybackStateData) => {
          dispatch({ type: 'SET', payload: data });
          applyStateToMedia(data);
        }),
    [applyStateToMedia],
  );

  const play = useCallback(() => post({ action: 'play' }), [post]);
  const pause = useCallback(() => {
    const pos = getMediaEl()?.currentTime ?? state.position;
    return post({ action: 'pause', position: pos });
  }, [post, state.position]);
  const seek = useCallback(
    (pos: number) => {
      const media = getMediaEl();
      if (media) media.currentTime = pos;
      return post({ action: 'seek', position: pos });
    },
    [post],
  );
  const next = useCallback(() => post({ action: 'next' }), [post]);
  const prev = useCallback(() => post({ action: 'prev' }), [post]);
  const loadEpisode = useCallback(
    (id: number, context: PlaybackStateData['context'], podcastId?: number) =>
      post({
        action: 'load',
        episodeId: id,
        context,
        contextPodcastId: podcastId ?? null,
      }),
    [post],
  );
  const toggleFavorite = useCallback(async () => {
    if (!state.episodeId || !state.episode) return;
    const newFavorited = !state.episode.favorited;
    await fetch(`/api/episodes/${state.episodeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorited: newFavorited }),
    });
  }, [state.episodeId, state.episode]);

  const joinAudio = useCallback(() => {
    const media = getMediaEl();
    if (!media) return;
    media.muted = false;
    setAudioDetached(false);
  }, []);

  const currentPosition = useCallback(() => {
    const media = getMediaEl();
    // Prefer the live media element time — it's accurate and bounded by actual duration
    if (media && media.readyState >= 1) return media.currentTime;
    if (!state.isPlaying) return state.position;
    return (
      state.position + (Date.now() - new Date(state.updatedAt).getTime()) / 1000
    );
  }, [state]);

  // Media Session API — feeds macOS Now Playing, iOS Control Center, lock screen
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    if (!state.episode) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
      return;
    }

    const rawArt =
      state.episode.imageUrl ?? state.episode.podcast.imageUrl ?? '';
    const artSrc = rawArt
      ? rawArt.startsWith('/')
        ? `${window.location.origin}${rawArt}`
        : rawArt
      : null;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: state.episode.title,
      artist: state.episode.podcast.author ?? state.episode.podcast.title,
      album: state.episode.podcast.title,
      artwork: artSrc ? [{ src: artSrc }] : [],
    });

    navigator.mediaSession.playbackState = state.isPlaying
      ? 'playing'
      : 'paused';

    navigator.mediaSession.setActionHandler('play', () => play());
    navigator.mediaSession.setActionHandler('pause', () => pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => prev());
    navigator.mediaSession.setActionHandler('nexttrack', () => next());
    navigator.mediaSession.setActionHandler('seekbackward', (d) =>
      seek(
        Math.max(
          0,
          (getMediaEl()?.currentTime ?? state.position) - (d.seekOffset ?? 15),
        ),
      ),
    );
    navigator.mediaSession.setActionHandler('seekforward', (d) =>
      seek(
        (getMediaEl()?.currentTime ?? state.position) + (d.seekOffset ?? 30),
      ),
    );
    navigator.mediaSession.setActionHandler('seekto', (d) => {
      if (d.seekTime != null) seek(d.seekTime);
    });
  }, [
    state.episode,
    state.isPlaying,
    play,
    pause,
    prev,
    next,
    seek,
    state.position,
  ]);

  // Dynamic page title
  useEffect(() => {
    if (state.episode) {
      document.title = `${state.episode.title} - ${state.episode.podcast.title}`;
    } else {
      document.title = 'Podhomme';
    }
  }, [state.episode]);

  // Expose window.podhomme for BeardedSpice
  useEffect(() => {
    (window as any).podhomme = {
      isPlaying: () => state.isPlaying,
      toggle: () => (state.isPlaying ? pause() : play()),
      pause,
      skipBack: () =>
        seek(Math.max(0, (getMediaEl()?.currentTime ?? state.position) - 15)),
      skipForward: () =>
        seek((getMediaEl()?.currentTime ?? state.position) + 30),
      favorite: toggleFavorite,
      trackInfo: () => {
        const rawImage =
          state.episode?.imageUrl ?? state.episode?.podcast.imageUrl ?? '';
        const image = rawImage.startsWith('/')
          ? `${window.location.origin}${rawImage}`
          : rawImage;
        return {
          track: state.episode?.title ?? '',
          album: state.episode?.podcast.title ?? '',
          artist: state.episode?.podcast.author ?? '',
          image,
          favorited: state.episode?.favorited ?? false,
        };
      },
    };
  }, [state, play, pause, next, prev, toggleFavorite, seek]);

  const onEnded = useCallback(() => post({ action: 'next' }), [post]);

  return (
    <PlaybackContext.Provider
      value={{
        state,
        isVideo,
        audioDetached,
        mediaDuration,
        joinAudio,
        registerVideoElement,
        currentPosition,
        play,
        pause,
        seek,
        next,
        prev,
        loadEpisode,
        toggleFavorite,
      }}
    >
      {/* Hidden audio element — always in DOM */}
      <audio
        ref={audioRef}
        onEnded={onEnded}
        onLoadedMetadata={() =>
          setMediaDuration(audioRef.current?.duration ?? 0)
        }
      />
      {children}
    </PlaybackContext.Provider>
  );
}

export function usePlayback() {
  const ctx = useContext(PlaybackContext);
  if (!ctx) throw new Error('usePlayback must be used within PlaybackProvider');
  return ctx;
}
