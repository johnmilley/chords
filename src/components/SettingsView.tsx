import { useRef, useState } from 'react';
import type { Settings } from '../types';
import { exportBackup, importBackup, type Backup } from '../lib/storage';
import { IconBack, IconDownload } from './icons';

interface Props {
  settings: Settings;
  songCount: number;
  onBack: () => void;
  onChange: (patch: Partial<Settings>) => void;
  onDataChanged: () => void;
}

export function SettingsView({ settings, songCount, onBack, onChange, onDataChanged }: Props) {
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const doExport = async () => {
    const data = await exportBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chords-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg('Backup downloaded.');
  };

  const doImport = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as Backup;
      await importBackup(data, 'merge');
      onDataChanged();
      setMsg(`Imported ${data.songs?.length ?? 0} songs.`);
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`);
    }
  };

  return (
    <div className="app">
      <div className="topbar">
        <button className="iconbtn" onClick={onBack} aria-label="Back"><IconBack /></button>
        <h1>Settings</h1>
      </div>
      <div className="scroll">
        <div className="settings">
          <div className="setting-group">
            <h3>Appearance</h3>
            <div className="setting-row">
              <div className="label">Theme</div>
              <div className="seg-control">
                {(['system', 'light', 'dark'] as const).map((t) => (
                  <button key={t} className={settings.theme === t ? 'on' : ''} onClick={() => onChange({ theme: t })}>
                    {t[0].toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="setting-row">
              <div><div className="label">Base font size</div><div className="desc">{settings.fontSize}px in the reader</div></div>
              <div className="seg-control">
                <button onClick={() => onChange({ fontSize: Math.max(12, settings.fontSize - 1) })}>A−</button>
                <button onClick={() => onChange({ fontSize: Math.min(30, settings.fontSize + 1) })}>A+</button>
              </div>
            </div>
          </div>

          <div className="setting-group">
            <h3>Chord diagrams</h3>
            <div className="setting-row">
              <div className="label">Default instrument</div>
              <div className="seg-control">
                <button className={settings.instrument === 'guitar' ? 'on' : ''} onClick={() => onChange({ instrument: 'guitar' })}>Guitar</button>
                <button className={settings.instrument === 'piano' ? 'on' : ''} onClick={() => onChange({ instrument: 'piano' })}>Piano</button>
              </div>
            </div>
            <div className="setting-row">
              <div><div className="label">Left-handed diagrams</div><div className="desc">Mirror guitar fingerings</div></div>
              <button className={`switch${settings.leftHanded ? ' on' : ''}`} onClick={() => onChange({ leftHanded: !settings.leftHanded })} aria-label="Left-handed" />
            </div>
          </div>

          <div className="setting-group">
            <h3>Import</h3>
            <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <div><div className="label">Import proxy URL</div><div className="desc">Lets link-import fetch chord pages. Leave blank to paste only.</div></div>
              <input
                style={{ marginTop: 10, background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 13px' }}
                value={settings.proxyUrl}
                onChange={(e) => onChange({ proxyUrl: e.target.value.trim() })}
                placeholder="https://your-worker.workers.dev"
                autoCapitalize="none"
                inputMode="url"
              />
            </div>
          </div>

          <div className="setting-group">
            <h3>Your data · {songCount} songs</h3>
            <div className="setting-row" style={{ border: 'none', gap: 10 }}>
              <button className="btn" onClick={doExport} style={{ flex: 1 }}><IconDownload size={18} /> Export backup</button>
              <button className="btn" onClick={() => fileRef.current?.click()} style={{ flex: 1 }}>Import backup</button>
              <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
            </div>
            <div className="desc" style={{ padding: '0 4px' }}>
              Everything is stored locally in this browser. Export regularly to move between devices.
            </div>
          </div>

          {msg && <div className="notice ok">{msg}</div>}

          <div style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: 12, marginTop: 20 }}>
            Chords · a clean chord reader
          </div>
        </div>
      </div>
    </div>
  );
}
