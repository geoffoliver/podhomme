'use client'

import { useState } from 'react'
import { TopBar } from '@/components/TopBar'
import { SplitPane } from '@/components/SplitPane'
import { SettingsDialog } from '@/components/Settings'
import { VideoPanel } from '@/components/VideoPanel'

export default function Home() {
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <>
      <TopBar onSettingsClick={() => setSettingsOpen(true)} />
      <VideoPanel />
      <SplitPane />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}
