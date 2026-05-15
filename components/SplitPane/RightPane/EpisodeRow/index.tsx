'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Podcast, Play, MoreVertical, Star, StarOff, Download, CheckCircle, Circle, GripVertical } from 'lucide-react'
import type { Episode } from '@/types'
import { usePlayback } from '@/context/PlaybackContext'
import styles from './index.module.css'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatDuration(seconds: number | null) {
  if (!seconds) return null
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

type Props = {
  episode: Episode
  context: 'all' | 'podcast' | 'favorites'
  contextPodcastId?: number
  onDetail: (episode: Episode) => void
  dragHandleProps?: React.HTMLAttributes<HTMLElement>
}

export function EpisodeRow({ episode, context, contextPodcastId, onDetail, dragHandleProps }: Props) {
  const { loadEpisode } = usePlayback()
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [localPlayed, setLocalPlayed] = useState<boolean | null>(null)
  const [localFavorited, setLocalFavorited] = useState<boolean | null>(null)

  // When the SSE-driven prop updates, drop the local override
  useEffect(() => { setLocalPlayed(null) }, [episode.played])
  useEffect(() => { setLocalFavorited(null) }, [episode.favorited])

  const played = localPlayed ?? episode.played
  const favorited = localFavorited ?? episode.favorited

  const artUrl = episode.imageUrl ?? episode.podcast?.imageUrl ?? null

  function patchEpisode(data: { played?: boolean; favorited?: boolean }) {
    if ('played' in data) setLocalPlayed(data.played!)
    if ('favorited' in data) setLocalFavorited(data.favorited!)
    fetch(`/api/episodes/${episode.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(() => {
      if ('played' in data) setLocalPlayed(null)
      if ('favorited' in data) setLocalFavorited(null)
    })
  }

  function handleDownload() {
    const a = document.createElement('a')
    a.href = episode.downloadPath
      ? `/api/episodes/${episode.id}/file`
      : episode.audioUrl
    a.download = `${episode.title}.mp3`
    a.click()
  }

  return (
    <article className={`${styles.row} ${played ? styles.rowPlayed : ''}`}>
      {dragHandleProps && (
        <span className={styles.dragHandle} {...dragHandleProps} aria-label="Drag to reorder">
          <GripVertical size={16} />
        </span>
      )}

      {artUrl ? (
        <Image src={artUrl} alt="" width={48} height={48} className={styles.artwork} />
      ) : (
        <div className={styles.artworkPlaceholder}><Podcast size={20} /></div>
      )}

      <div className={styles.body}>
        <button
          className={styles.title}
          onClick={() => onDetail(episode)}
        >
          {episode.title}
        </button>
        <div className={styles.meta}>
          <span>{formatDate(episode.pubDate)}</span>
          {episode.duration && <span>·</span>}
          {episode.duration && (
            <span>
              {episode.resumeAt > 0
                ? `${formatDuration(Math.max(0, episode.duration - Math.floor(episode.resumeAt)))} remaining`
                : formatDuration(episode.duration)}
            </span>
          )}
          {episode.podcast?.title && <span>·</span>}
          {episode.podcast?.title && <span>{episode.podcast.title}</span>}
        </div>
        {episode.description && (
          <p className={styles.description} dangerouslySetInnerHTML={{ __html: episode.description }} />
        )}
      </div>

      <div className={styles.menu} ref={menuRef}>
        <button
          className="btn-icon"
          onClick={() => loadEpisode(episode.id, context, contextPodcastId)}
          title="Play"
          aria-label="Play episode"
        >
          <Play size={16} />
        </button>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button
            className="btn-icon"
            onClick={() => setMenuOpen(v => !v)}
            aria-label="More actions"
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                onClick={() => setMenuOpen(false)}
              />
              <div className={styles.menuPopover} style={{ position: 'absolute', right: 0, top: '100%', zIndex: 50 }}>
                <button
                  className={styles.menuItem}
                  onClick={() => { patchEpisode({ played: !played }); setMenuOpen(false) }}
                >
                  {played ? <Circle size={14} /> : <CheckCircle size={14} />}
                  Mark as {played ? 'unplayed' : 'played'}
                </button>
                <button
                  className={styles.menuItem}
                  onClick={() => { patchEpisode({ favorited: !favorited }); setMenuOpen(false) }}
                >
                  {favorited ? <StarOff size={14} /> : <Star size={14} />}
                  {favorited ? 'Unfavorite' : 'Favorite'}
                </button>
                <button
                  className={styles.menuItem}
                  onClick={() => { handleDownload(); setMenuOpen(false) }}
                >
                  <Download size={14} /> Download
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </article>
  )
}
