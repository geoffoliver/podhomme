'use client';

import { SettingsDialog } from '@/components/Settings';
import { SplitPane } from '@/components/SplitPane';
import { TopBar } from '@/components/TopBar';
import { VideoPanel } from '@/components/VideoPanel';
import { useState } from 'react';

export default function Home() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <TopBar onSettingsClick={() => setSettingsOpen(true)} />
      <VideoPanel />
      <SplitPane />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
