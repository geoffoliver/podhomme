'use client'

import { useCallback, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Maximize2 } from 'lucide-react'
import { usePlayback } from '@/context/PlaybackContext'
import styles from './index.module.css'

export function VideoPanel() {
  const { state, isVideo, registerVideoElement } = usePlayback()
  const [minimized, setMinimized] = useState(false)
  const videoElRef = useRef<HTMLVideoElement | null>(null)

  const videoRefCallback = useCallback((el: HTMLVideoElement | null) => {
    videoElRef.current = el
    registerVideoElement(el)
  }, [registerVideoElement])

  const handleFullscreen = () => {
    videoElRef.current?.requestFullscreen()
  }

  const visible = isVideo && !!state.episode

  return (
    <div className={`${styles.panel} ${!visible ? styles.hidden : ''}`}>
      <div className={styles.toolbar}>
        <span className={styles.label}>Video</span>
        <button className="btn-icon" onClick={handleFullscreen} title="Fullscreen">
          <Maximize2 size={14} />
        </button>
        <button
          className="btn-icon"
          onClick={() => setMinimized(m => !m)}
          title={minimized ? 'Show video' : 'Minimize'}
        >
          {minimized ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>
      <div className={`${styles.videoWrap} ${minimized ? styles.videoWrapMinimized : ''}`}>
        <video ref={videoRefCallback} className={styles.video} />
      </div>
    </div>
  )
}
