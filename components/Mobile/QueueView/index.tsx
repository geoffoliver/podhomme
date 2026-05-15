'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Inbox, Play, Podcast, MoreVertical, CheckCircle, Star, StarOff, ArrowUp, ArrowDown } from 'lucide-react'
import { usePodcasts } from '@/context/PodcastsContext'
import { usePlayback } from '@/context/PlaybackContext'
import { EpisodeDetail } from '@/components/SplitPane/RightPane/EpisodeDetail'
import type { Episode } from '@/types'
import styles from './index.module.css'

function formatRemaining(duration: number | null, resumeAt: number): string | null {
  if (!duration) return null
  const secs = resumeAt > 0 ? Math.max(0, duration - Math.floor(resumeAt)) : duration
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return resumeAt > 0 ? `${h}h ${m}m left` : `${h}h ${m}m`
  if (m > 0) return resumeAt > 0 ? `${m}m left` : `${m}m`
  return null
}

function formatTotal(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `[${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}]`
}

export function QueueView() {
  const { queue } = usePodcasts()
  const { loadEpisode } = usePlayback()
  const [detailEpisode, setDetailEpisode] = useState<Episode | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null)

  const totalSeconds = queue.reduce((sum, item) => {
    const remaining = (item.episode.duration ?? 0) - Math.floor(item.episode.resumeAt ?? 0)
    return sum + Math.max(0, remaining)
  }, 0)

  function patchEpisode(id: number, data: object) {
    fetch(`/api/episodes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  }

  function moveItem(fromIdx: number, toIdx: number) {
    const a = queue[fromIdx]
    const b = queue[toIdx]
    fetch('/api/queue', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { id: a.id, position: b.position },
        { id: b.id, position: a.position },
      ]),
    })
  }

  return (
    <div className={styles.view}>
      <div className={styles.header}>
        <h1 className={styles.headerTitle}>Queue</h1>
        <span className={styles.headerMeta}>
          {queue.length} unplayed{totalSeconds > 0 ? ` ${formatTotal(totalSeconds)}` : ''}
        </span>
      </div>

      {queue.length === 0 ? (
        <div className={styles.empty}>
          <Inbox size={36} />
          <span>No unplayed episodes</span>
        </div>
      ) : (
        <div className={styles.list}>
          {queue.map((item, idx) => {
            const ep = item.episode
            const artUrl = ep.imageUrl ?? ep.podcast?.imageUrl ?? null
            const dur = formatRemaining(ep.duration, ep.resumeAt)
            const menuOpen = menuOpenId === ep.id
            return (
              <div key={item.id} className={styles.row}>
                <button className={styles.rowMain} onClick={() => loadEpisode(ep.id, 'all')}>
                  {artUrl ? (
                    <Image src={artUrl} alt="" width={52} height={52} className={styles.artwork} />
                  ) : (
                    <div className={styles.artworkPlaceholder}><Podcast size={22} /></div>
                  )}
                  <div className={styles.info}>
                    <span className={styles.title}>{ep.title}</span>
                    <span className={styles.meta}>
                      {ep.podcast?.title}{dur ? ` · ${dur}` : ''}
                    </span>
                  </div>
                  <Play size={18} className={styles.playIcon} />
                </button>

                <div className={styles.menuWrap}>
                  <button
                    className={styles.menuBtn}
                    onClick={() => setMenuOpenId(menuOpen ? null : ep.id)}
                    aria-label="More actions"
                  >
                    <MoreVertical size={18} />
                  </button>
                  {menuOpen && (
                    <>
                      <div className={styles.menuBackdrop} onClick={() => setMenuOpenId(null)} />
                      <div className={styles.menu}>
                        <button className={styles.menuItem} onClick={() => { setDetailEpisode(ep as unknown as Episode); setMenuOpenId(null) }}>
                          Episode detail
                        </button>
                        {idx > 0 && (
                          <button className={styles.menuItem} onClick={() => { moveItem(idx, idx - 1); setMenuOpenId(null) }}>
                            <ArrowUp size={15} /> Move up
                          </button>
                        )}
                        {idx < queue.length - 1 && (
                          <button className={styles.menuItem} onClick={() => { moveItem(idx, idx + 1); setMenuOpenId(null) }}>
                            <ArrowDown size={15} /> Move down
                          </button>
                        )}
                        <button className={styles.menuItem} onClick={() => { patchEpisode(ep.id, { played: true }); setMenuOpenId(null) }}>
                          <CheckCircle size={15} /> Mark played
                        </button>
                        <button className={styles.menuItem} onClick={() => { patchEpisode(ep.id, { favorited: !ep.favorited }); setMenuOpenId(null) }}>
                          {ep.favorited ? <><StarOff size={15} /> Unfavorite</> : <><Star size={15} /> Favorite</>}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <EpisodeDetail episode={detailEpisode} onClose={() => setDetailEpisode(null)} />
    </div>
  )
}
