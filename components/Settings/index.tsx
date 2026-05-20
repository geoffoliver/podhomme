'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import type { Settings } from '@/types';
import { usePodcasts } from '@/context/PodcastsContext';
import styles from './index.module.css';

type Props = {
  open: boolean;
  onClose: () => void;
};

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
  const { refreshPodcasts } = usePodcasts();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const opmlImportRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [localAddresses, setLocalAddresses] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      el.showModal();
      fetch('/api/settings')
        .then((r) => r.json())
        .then(setSettings);
      fetch('/api/local-address')
        .then((r) => r.json())
        .then((d) => setLocalAddresses(d.addresses ?? []));
    } else {
      el.close();
    }
  }, [open]);

  function update(key: keyof Settings, value: string | number) {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
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

  async function handleImportOpml(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    await fetch('/api/import/opml', { method: 'POST', body: form });
    refreshPodcasts();
    e.target.value = '';
  }

  function handleExportOpml() {
    const a = document.createElement('a');
    a.href = '/api/export/opml';
    a.download = 'podhomme.opml';
    a.click();
  }

  function handleClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onClose={onClose}
      onClick={handleClick}
    >
      <div className={styles.header}>
        <h2 className={styles.title}>Settings</h2>
      </div>

      {settings && (
        <div className={styles.body}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="refreshFrequency">
              Refresh frequency
            </label>
            <select
              id="refreshFrequency"
              className="select"
              value={settings.refreshFrequency}
              onChange={(e) =>
                update('refreshFrequency', Number(e.target.value))
              }
            >
              {REFRESH_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="episodesToKeep">
              Episodes to keep
            </label>
            <select
              id="episodesToKeep"
              className="select"
              value={settings.episodesToKeep}
              onChange={(e) => update('episodesToKeep', e.target.value)}
            >
              {KEEP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="defaultPlayback">
              Default playback
            </label>
            <select
              id="defaultPlayback"
              className="select"
              value={settings.defaultPlayback}
              onChange={(e) => update('defaultPlayback', e.target.value)}
            >
              <option value="stream">Stream</option>
              <option value="download">Download first</option>
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="downloadLocation">
              Download location
            </label>
            <input
              id="downloadLocation"
              className="input"
              type="text"
              value={settings.downloadLocation}
              onChange={(e) => update('downloadLocation', e.target.value)}
              placeholder="./downloads"
            />
          </div>

          {localAddresses.length > 0 && (
            <div className={styles.field}>
              <span className={styles.label}>Local address</span>
              <div className={styles.localAddresses}>
                {localAddresses.map((addr) => (
                  <a
                    key={addr}
                    href={addr}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.localAddress}
                  >
                    {addr}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className={styles.field}>
            <span className={styles.label}>Subscriptions</span>
            <div className={styles.importExport}>
              <button
                type="button"
                className="btn-ghost text-sm gap-1.5"
                onClick={() => opmlImportRef.current?.click()}
                aria-label="Import OPML"
              >
                <Upload size={14} />
                Import OPML
              </button>
              <button
                type="button"
                className="btn-ghost text-sm gap-1.5"
                onClick={handleExportOpml}
                aria-label="Export OPML"
              >
                <Download size={14} />
                Export OPML
              </button>
              <input
                ref={opmlImportRef}
                type="file"
                accept=".opml,application/xml,text/xml"
                className="hidden"
                onChange={handleImportOpml}
              />
            </div>
          </div>
        </div>
      )}

      <div className={styles.footer}>
        <a
          href="https://github.com/geoffoliver/podhomme"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.githubLink}
          aria-label="View on GitHub"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
          </svg>
        </a>
        <button className="btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn-primary"
          onClick={save}
          disabled={!dirty || saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </dialog>
  );
}
