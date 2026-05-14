'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react'
import type { PlaybackStateData } from '@/types'
import { useSse } from './SseContext'

type Action = { type: 'SET'; payload: PlaybackStateData }

const defaultState: PlaybackStateData = {
  id: 1,
  episodeId: null,
  position: 0,
  isPlaying: false,
  context: 'all',
  contextPodcastId: null,
  updatedAt: new Date().toISOString(),
  episode: null,
}

function reducer(state: PlaybackStateData, action: Action): PlaybackStateData {
  if (action.type === 'SET') return action.payload
  return state
}

type Ctx = {
  state: PlaybackStateData
  audioDetached: boolean
  joinAudio: () => void
  currentPosition: () => number
  play: () => void
  pause: () => void
  seek: (pos: number) => void
  next: () => void
  prev: () => void
  loadEpisode: (id: number, context: PlaybackStateData['context'], podcastId?: number) => void
  toggleFavorite: () => void
}

export const PlaybackContext = createContext<Ctx | null>(null)

export function PlaybackProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, defaultState)
  const [audioDetached, setAudioDetached] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const syncRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevEpisodeIdRef = useRef<number | null>(null)

  // Load initial state
  useEffect(() => {
    fetch('/api/playback')
      .then(r => r.json())
      .then((data: PlaybackStateData) => {
        dispatch({ type: 'SET', payload: data })
        prevEpisodeIdRef.current = data.episodeId
        const audio = audioRef.current
        if (audio && data.episode) {
          audio.src = data.episode.audioUrl
          audio.currentTime = data.position
          if (data.isPlaying) {
            audio.play()
              .then(() => setAudioDetached(false))
              .catch(() => setAudioDetached(true))
          }
        }
      })
  }, [])

  const applyStateToAudio = useCallback((data: PlaybackStateData) => {
    const audio = audioRef.current
    if (!audio) return

    if (!data.isPlaying) setAudioDetached(false)

    if (data.episodeId !== prevEpisodeIdRef.current) {
      prevEpisodeIdRef.current = data.episodeId
      if (data.episode) {
        audio.src = data.episode.audioUrl
        audio.currentTime = 0
        if (data.isPlaying) {
          audio.play()
            .then(() => setAudioDetached(false))
            .catch(() => setAudioDetached(true))
        }
      } else {
        audio.pause()
        audio.src = ''
      }
    } else {
      if (data.isPlaying && audio.paused) {
        audio.play()
          .then(() => setAudioDetached(false))
          .catch(() => setAudioDetached(true))
      } else if (!data.isPlaying && !audio.paused) {
        audio.pause()
      }
      // Correct significant drift (seek from another client)
      const expected = data.isPlaying
        ? data.position + (Date.now() - new Date(data.updatedAt).getTime()) / 1000
        : data.position
      if (Math.abs(audio.currentTime - expected) > 5) {
        audio.currentTime = Math.max(0, expected)
      }
    }
  }, [])

  useSse((event, data) => {
    if (event === 'playback') {
      const payload = data as PlaybackStateData
      dispatch({ type: 'SET', payload })
      applyStateToAudio(payload)
    }
  })

  // 5s position heartbeat while playing
  useEffect(() => {
    if (state.isPlaying) {
      syncRef.current = setInterval(() => {
        const pos = audioRef.current?.currentTime
        if (pos !== undefined) {
          fetch('/api/playback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'sync', position: pos }),
          }).catch(() => {})
        }
      }, 5000)
    }
    return () => { if (syncRef.current) clearInterval(syncRef.current) }
  }, [state.isPlaying])

  const post = useCallback((body: object) =>
    fetch('/api/playback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(r => r.json())
      .then((data: PlaybackStateData) => {
        dispatch({ type: 'SET', payload: data })
        applyStateToAudio(data)
      }),
    [applyStateToAudio]
  )

  const play = useCallback(() => post({ action: 'play' }), [post])
  const pause = useCallback(() => {
    const pos = audioRef.current?.currentTime ?? state.position
    return post({ action: 'pause', position: pos })
  }, [post, state.position])
  const seek = useCallback((pos: number) => {
    if (audioRef.current) audioRef.current.currentTime = pos
    return post({ action: 'seek', position: pos })
  }, [post])
  const next = useCallback(() => post({ action: 'next' }), [post])
  const prev = useCallback(() => post({ action: 'prev' }), [post])
  const loadEpisode = useCallback(
    (id: number, context: PlaybackStateData['context'], podcastId?: number) =>
      post({ action: 'load', episodeId: id, context, contextPodcastId: podcastId ?? null }),
    [post]
  )
  const toggleFavorite = useCallback(async () => {
    if (!state.episodeId || !state.episode) return
    const newFavorited = !state.episode.favorited
    await fetch(`/api/episodes/${state.episodeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorited: newFavorited }),
    })
  }, [state.episodeId, state.episode])

  const joinAudio = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.play().then(() => setAudioDetached(false)).catch(() => {})
  }, [])

  const currentPosition = useCallback(() => {
    if (!state.isPlaying) return state.position
    return state.position + (Date.now() - new Date(state.updatedAt).getTime()) / 1000
  }, [state])

  // Expose window.podhomme for BeardedSpice
  useEffect(() => {
    ;(window as any).podhomme = {
      isPlaying: () => state.isPlaying,
      toggle: () => (state.isPlaying ? pause() : play()),
      pause,
      previous: prev,
      next,
      favorite: toggleFavorite,
      trackInfo: () => {
        const rawImage = state.episode?.imageUrl ?? state.episode?.podcast.imageUrl ?? ''
        const image = rawImage.startsWith('/')
          ? `${window.location.origin}${rawImage}`
          : rawImage
        return {
          track: state.episode?.title ?? '',
          album: state.episode?.podcast.title ?? '',
          artist: state.episode?.podcast.author ?? '',
          image,
          favorited: state.episode?.favorited ?? false,
        };
      },
    }
  }, [state, play, pause, next, prev, toggleFavorite])

  return (
    <PlaybackContext.Provider value={{ state, audioDetached, joinAudio, currentPosition, play, pause, seek, next, prev, loadEpisode, toggleFavorite }}>
      {/* Hidden audio element owned by this context */}
      <audio ref={audioRef} onEnded={() => post({ action: 'next' })} />
      {children}
    </PlaybackContext.Provider>
  )
}

export function usePlayback() {
  const ctx = useContext(PlaybackContext)
  if (!ctx) throw new Error('usePlayback must be used within PlaybackProvider')
  return ctx
}
