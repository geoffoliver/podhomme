'use client';

import { useEffect, useState } from 'react';
import { ChatDrawer } from '@/components/Chat';
import { SettingsDialog } from '@/components/Settings';
import { SplitPane } from '@/components/SplitPane';
import { TopBar } from '@/components/TopBar';
import { VideoPanel } from '@/components/VideoPanel';

export default function Home() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const handler = () => setSettingsOpen(true);
    window.addEventListener('electron:open-settings', handler);
    return () => window.removeEventListener('electron:open-settings', handler);
  }, []);
  const [chatOpen, setChatOpen] = useState(false);
  const [hasUnreadChat, setHasUnreadChat] = useState(false);

  function openChat() {
    setChatOpen((v) => !v);
    setHasUnreadChat(false);
  }

  return (
    <>
      <TopBar
        onSettingsClick={() => setSettingsOpen(true)}
        onChatClick={openChat}
        chatOpen={chatOpen}
        hasUnreadChat={hasUnreadChat}
      />
      <VideoPanel />
      <div className="flex flex-1 overflow-hidden">
        <SplitPane />
        <ChatDrawer
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          onMessage={() => setHasUnreadChat(true)}
        />
      </div>
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}
