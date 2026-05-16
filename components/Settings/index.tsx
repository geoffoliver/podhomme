'use client';

import {
 useEffect, useRef, useState, 
} from 'react';
import type { Settings } from '@/types';
import styles from './index.module.css';

type Props = {
  open: boolean
  onClose: () => void
}

const REFRESH_OPTIONS = [
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 180, label: '3 hours' },
  { value: 720, label: '12 hours' },
  { value: 1440, label: '1 day' },
];

const KEEP_OPTIONS = [
  { value: '1', label: '1 episode' },
  { value: '2', label: '2 episodes' },
  { value: '3', label: '3 episodes' },
  { value: '5', label: '5 episodes' },
  { value: 'all_unplayed', label: 'All unplayed' },
  { value: 'all', label: 'All episodes' },
];

export function SettingsDialog({ open, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      el.showModal();
      fetch('/api/settings').then(r => r.json()).then(setSettings);
    } else {
      el.close();
    }
  }, [open]);

  function update(key: keyof Settings, value: string | number) {
    setSettings(s => s ? { ...s, [key]: value } : s);
    setDirty(true);
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setDirty(false);
    onClose();
  }

  function handleClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) onClose();
  }

  return (
    <dialog ref={dialogRef} className={styles.dialog} onClose={onClose} onClick={handleClick}>
      <div className={styles.header}>
        <h2 className={styles.title}>Settings</h2>
      </div>

      {settings && (
        <div className={styles.body}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="refreshFrequency">Refresh frequency</label>
            <select
              id="refreshFrequency"
              className="select"
              value={settings.refreshFrequency}
              onChange={e => update('refreshFrequency', Number(e.target.value))}
            >
              {REFRESH_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="episodesToKeep">Episodes to keep</label>
            <select
              id="episodesToKeep"
              className="select"
              value={settings.episodesToKeep}
              onChange={e => update('episodesToKeep', e.target.value)}
            >
              {KEEP_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="defaultPlayback">Default playback</label>
            <select
              id="defaultPlayback"
              className="select"
              value={settings.defaultPlayback}
              onChange={e => update('defaultPlayback', e.target.value)}
            >
              <option value="stream">Stream</option>
              <option value="download">Download first</option>
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="downloadLocation">Download location</label>
            <input
              id="downloadLocation"
              className="input"
              type="text"
              value={settings.downloadLocation}
              onChange={e => update('downloadLocation', e.target.value)}
              placeholder="./downloads"
            />
          </div>
        </div>
      )}

      <div className={styles.footer}>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={!dirty || saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </dialog>
  );
}
