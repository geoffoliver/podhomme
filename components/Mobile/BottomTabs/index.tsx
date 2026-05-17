'use client';

import {
  Inbox, Library, MessageSquare, Star,
} from 'lucide-react';
import type { MobileTab } from '../Shell';
import styles from './index.module.css';

type Props = {
  tab: MobileTab
  onTab: (tab: MobileTab) => void
  unreadChat?: boolean
}

const TABS: { id: MobileTab; label: string; icon: React.ReactNode }[] = [
  {
 id: 'queue',     label: 'Queue',     icon: <Inbox size={22} />, 
},
  {
 id: 'library',  label: 'Library',   icon: <Library size={22} />, 
},
  {
    id: 'favorites', label: 'Favorites', icon: <Star size={22} />,
  },
  {
    id: 'chat', label: 'Chat', icon: <MessageSquare size={22} />,
  },
];

export function BottomTabs({ tab, onTab, unreadChat }: Props) {
  return (
    <nav className={styles.nav} aria-label="Main navigation">
      {TABS.map(t => (
        <button
          key={t.id}
          className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
          onClick={() => onTab(t.id)}
          aria-current={tab === t.id ? 'page' : undefined}
        >
          <div className={styles.iconWrap}>
            {t.icon}
            {t.id === 'chat' && unreadChat && <span className={styles.unreadDot} aria-hidden="true" />}
          </div>
          <span className={styles.label}>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
