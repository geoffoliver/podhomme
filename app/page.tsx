'use client';

import { SettingsDialog } from '@/components/Settings';
import { SplitPane } from '@/components/SplitPane';
import { TopBar } from '@/components/TopBar';
import { VideoPanel } from '@/components/VideoPanel';
import { ChatDrawer } from '@/components/Chat';
import { useState } from 'react';

export default function Home() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <>
      <TopBar
        onSettingsClick={() => setSettingsOpen(true)}
        onChatClick={() => setChatOpen(v => !v)}
        chatOpen={chatOpen}
      />
      <VideoPanel />
      <div className="flex flex-1 overflow-hidden">
        <SplitPane />
        <ChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} />
      </div>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
