import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  KeyRound,
  Server,
  ShieldCheck,
  Trash2,
  X
} from 'lucide-react';
import { ExnessConnectivityReport } from '../types/office';
import { ExnessStatusState } from './FinanceConsoleModal';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  exnessStatus: ExnessStatusState | null;
  onRefreshExnessStatus: () => Promise<void>;
}

interface ProviderSettingsStatus {
  nineRouterUrl: string;
  nineRouterHasKey: boolean;
  nineRouterKeyLast4: string | null;
  freeLlmApiUrl: string;
  freeLlmApiHasKey: boolean;
  freeLlmApiKeyLast4: string | null;
  n8nWebhookUrl: string;
  voiceboxUrl: string;
  youtubeChannel: string;
  youtubeClientIdLast4: string | null;
  youtubeHasSecret: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onClose,
  exnessStatus,
  onRefreshExnessStatus
}) => {
  const [tab, setTab] = useState<'exness' | 'providers'>('exness');
  const [activeProfile, setActiveProfile] = useState<'demo' | 'real'>('demo');

  // Exness form (matches server/kraServer.mjs /api/exness/save)
  const [discoveryBaseUrl, setDiscoveryBaseUrl] = useState('https://api.exness.com');
  const [apiKey, setApiKey] = useState('');
  const [accountId, setAccountId] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [savingExness, setSavingExness] = useState(false);
  const [exnessMsg, setExnessMsg] = useState<string | null>(null);
  const [testReport, setTestReport] = useState<ExnessConnectivityReport | null>(null);

  // Providers form (matches server/kraServer.mjs /api/settings/save)
  const [providerStatus, setProviderStatus] = useState<ProviderSettingsStatus | null>(null);
  const [nineRouterUrl, setNineRouterUrl] = useState('http://localhost:20128/v1');
  const [nineRouterKey, setNineRouterKey] = useState('');
  const [freeLlmApiUrl, setFreeLlmApiUrl] = useState('');
  const [freeLlmApiKey, setFreeLlmApiKey] = useState('');
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState('http://localhost:5678');
  const [voiceboxUrl, setVoiceboxUrl] = useState('http://127.0.0.1:17493');
  const [youtubeChannel, setYoutubeChannel] = useState('');
  const [youtubeClientId, setYoutubeClientId] = useState('');
  const [youtubeClientSecret, setYoutubeClientSecret] = useState('');
  const [providerMsg, setProviderMsg] = useState<string | null>(null);

  const loadProviders = async () => {
    try {
      const resp = await fetch('/api/settings/status');
      if (!resp.ok) return;
      const s = (await resp.json()) as ProviderSettingsStatus;
      setProviderStatus(s);
      if (s.nineRouterUrl) setNineRouterUrl(s.nineRouterUrl);
      if (s.freeLlmApiUrl) setFreeLlmApiUrl(s.freeLlmApiUrl);
      if (s.n8nWebhookUrl) setN8nWebhookUrl(s.n8nWebhookUrl);
      if (s.voiceboxUrl) setVoiceboxUrl(s.voiceboxUrl);
      if (s.youtubeChannel) setYoutubeChannel(s.youtubeChannel);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (open) {
      void onRefreshExnessStatus();
      void loadProviders();
    }
  }, [open, onRefreshExnessStatus]);

  if (!open) return null;

  const saveExness = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingExness(true);
    setExnessMsg(null);
    setTestReport(null);
    try {
      const resp = await fetch('/api/exness/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: activeProfile,
          discoveryBaseUrl,
          apiKey,
          accountId,
          privateKey,
          expiryDate
        })
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        setExnessMsg(`Gagal simpan: ${data.error || 'Periksa format HTTPS URL / Account ID uint64 / Ed25519 key.'}`);
      } else {
        setExnessMsg(
          `Tersimpan di server (.kra-secrets.json 0o600 & .kra-env.local) untuk Exness ${activeProfile.toUpperCase()}.`
        );
        setPrivateKey('');
        await onRefreshExnessStatus();
      }
    } catch (err) {
      setExnessMsg(err instanceof Error ? err.message : 'Gagal menghubungi server.');
    } finally {
      setSavingExness(false);
    }
  };

  const deleteExness = async () => {
    setExnessMsg(null);
    setTestReport(null);
    try {
      const resp = await fetch('/api/exness/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: activeProfile })
      });
      const data = await resp.json();
      if (data.ok) {
        setExnessMsg(`Kredensial Exness ${activeProfile.toUpperCase()} dihapus dari server.`);
        await onRefreshExnessStatus();
      }
    } catch {
      setExnessMsg('Gagal menghapus kredensial.');
    }
  };

  const testExness = async () => {
    setExnessMsg(null);
    try {
      const resp = await fetch('/api/exness/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: activeProfile })
      });
      const data = (await resp.json()) as ExnessConnectivityReport;
      setTestReport(data);
    } catch {
      setExnessMsg('Gagal menjalankan Test Connection.');
    }
  };

  const saveProviders = async (e: React.FormEvent) => {
    e.preventDefault();
    setProviderMsg(null);
    try {
      const resp = await fetch('/api/settings/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nineRouterUrl,
          nineRouterKey,
          freeLlmApiUrl,
          freeLlmApiKey,
          n8nWebhookUrl,
          voiceboxUrl,
          youtubeChannel,
          youtubeClientId,
          youtubeClientSecret
        })
      });
      const data = await resp.json();
      if (data.ok) {
        setProviderMsg('Konfigurasi provider & service tersimpan aman di server (0o600).');
        setNineRouterKey('');
        setFreeLlmApiKey('');
        setYoutubeClientSecret('');
        await loadProviders();
      } else {
        setProviderMsg(data.error || 'Gagal menyimpan konfigurasi.');
      }
    } catch {
      setProviderMsg('Gagal menghubungi server.');
    }
  };

  const currentProfileStatus = exnessStatus?.[activeProfile];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-amber-400/35 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white">
                SETTINGS KANTOR KRA — EXNESS (READ-ONLY) &amp; PROVIDER LOKAL
              </h2>
              <p className="text-[10px] text-slate-400">
                Secret disimpan server-side (.kra-secrets.json 0o600 + .kra-env.local), tidak pernah di localStorage atau browser bundle.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Subtabs */}
        <div className="flex gap-2 border-b border-slate-800 bg-slate-950/70 px-5 py-2 text-xs">
          <button
            onClick={() => setTab('exness')}
            className={`rounded-lg px-3 py-1.5 font-bold ${
              tab === 'exness' ? 'bg-amber-400 text-slate-950' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            🏦 Exness Read-Only (DEMO &amp; REAL)
          </button>
          <button
            onClick={() => setTab('providers')}
            className={`rounded-lg px-3 py-1.5 font-bold ${
              tab === 'providers' ? 'bg-amber-400 text-slate-950' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            🔌 9router · freellmapi · n8n · Voicebox · YouTube
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 text-xs">
          {tab === 'exness' ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-3 text-emerald-200">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <strong>Keamanan Kunci Exness:</strong> Key Ed25519 disimpan server-side saja, ditampilkan masked
                  (4 karakter terakhir), dan hanya dipakai oleh endpoint <code>GET</code> read-only.
                </div>
              </div>

              {/* Profile Selector */}
              <div className="flex gap-2">
                {(['demo', 'real'] as const).map((prof) => {
                  const st = exnessStatus?.[prof];
                  return (
                    <button
                      key={prof}
                      onClick={() => {
                        setActiveProfile(prof);
                        setTestReport(null);
                        setExnessMsg(null);
                      }}
                      className={`flex-1 rounded-xl border px-4 py-2.5 text-left transition ${
                        activeProfile === prof
                          ? 'border-amber-400 bg-amber-400/15 text-white'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-extrabold uppercase">Profil {prof}</div>
                      <div className="text-[10px]">
                        Status: {st?.configured ? `Tersimpan (${st.apiKeyLast4})` : 'BELUM DISET'}
                      </div>
                    </button>
                  );
                })}
              </div>

              {currentProfileStatus?.configured && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/80 p-3">
                  <div className="font-mono text-[10px] text-slate-300">
                    <div>
                      <strong>API Key:</strong> {currentProfileStatus.apiKeyLast4} ·{' '}
                      <strong>Account ID:</strong> {currentProfileStatus.accountIdMasked}
                    </div>
                    <div>
                      <strong>Gateway:</strong> {currentProfileStatus.discoveryBaseUrl} ·{' '}
                      <strong>Source:</strong> {currentProfileStatus.source}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => void testExness()}
                      className="flex items-center gap-1 rounded-lg border border-sky-400/40 bg-sky-500/15 px-2.5 py-1.5 font-bold text-sky-200 hover:bg-sky-500/25"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Test Koneksi
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteExness()}
                      className="flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/15 px-2.5 py-1.5 font-bold text-rose-200 hover:bg-rose-500/25"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Hapus
                    </button>
                  </div>
                </div>
              )}

              {testReport && (
                <div className="space-y-1 rounded-xl border border-slate-800 bg-slate-950 p-3 text-[11px]">
                  <div className="font-bold text-white">
                    Hasil Test ({activeProfile.toUpperCase()}): Self-Test {testReport.selfTest.passedCount}/
                    {testReport.selfTest.totalCount} · Discovery {testReport.discovery.status} · Account{' '}
                    {testReport.accountDetails.status}
                  </div>
                  {testReport.selfTest.checks.map((c) => (
                    <div key={c.name} className={c.pass ? 'text-emerald-300' : 'text-rose-300'}>
                      {c.pass ? '✓' : '✗'} {c.name}
                    </div>
                  ))}
                  {testReport.discovery.message && (
                    <div className="text-amber-300">{testReport.discovery.message}</div>
                  )}
                </div>
              )}

              <form onSubmit={saveExness} className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="font-bold text-slate-200">
                  Simpan / Perbarui Kredensial Exness {activeProfile.toUpperCase()}
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-400">Discovery Gateway URL (HTTPS origin)</span>
                    <input
                      value={discoveryBaseUrl}
                      onChange={(e) => setDiscoveryBaseUrl(e.target.value)}
                      required
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-400">Account ID (uint64 Exness)</span>
                    <input
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      required
                      placeholder="contoh: 123456789"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-400">API Key (EXN_{activeProfile.toUpperCase()}_API_KEY)</span>
                    <input
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      required
                      placeholder="exnsk-..."
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-400">Expiry Date (opsional)</span>
                    <input
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      placeholder="YYYY-MM-DD"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono text-white"
                    />
                  </label>
                </div>
                <label className="block space-y-1">
                  <span className="text-[10px] text-slate-400">
                    Ed25519 Private Key (128 hex chars atau PKCS#8 PEM — tidak pernah dikembalikan ke browser)
                  </span>
                  <textarea
                    rows={3}
                    value={privateKey}
                    onChange={(e) => setPrivateKey(e.target.value)}
                    required
                    placeholder="Masukkan private key Ed25519..."
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono text-white"
                  />
                </label>

                {exnessMsg && (
                  <div className="rounded-lg bg-slate-900 px-3 py-2 text-[11px] text-sky-200">{exnessMsg}</div>
                )}

                <button
                  type="submit"
                  disabled={savingExness}
                  className="rounded-xl bg-amber-400 px-4 py-2 font-extrabold text-slate-950 hover:bg-amber-300 disabled:opacity-40"
                >
                  {savingExness ? 'Menyimpan...' : `Simpan Exness ${activeProfile.toUpperCase()} ke Server`}
                </button>
              </form>
            </div>
          ) : (
            <form onSubmit={saveProviders} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
                  <div className="flex items-center gap-1.5 font-bold text-sky-300">
                    <Server className="h-3.5 w-3.5" /> 9router / CLI Proxy
                  </div>
                  <input
                    value={nineRouterUrl}
                    onChange={(e) => setNineRouterUrl(e.target.value)}
                    placeholder="http://localhost:20128/v1"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-white"
                  />
                  <input
                    type="password"
                    value={nineRouterKey}
                    onChange={(e) => setNineRouterKey(e.target.value)}
                    placeholder={
                      providerStatus?.nineRouterHasKey
                        ? `Tersimpan (${providerStatus.nineRouterKeyLast4}) — isi untuk ganti`
                        : 'API Key opsional'
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-white"
                  />
                </div>

                <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                    <Server className="h-3.5 w-3.5" /> freellmapi (Free LLM Endpoint)
                  </div>
                  <input
                    value={freeLlmApiUrl}
                    onChange={(e) => setFreeLlmApiUrl(e.target.value)}
                    placeholder="URL endpoint OpenAI-compatible"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-white"
                  />
                  <input
                    type="password"
                    value={freeLlmApiKey}
                    onChange={(e) => setFreeLlmApiKey(e.target.value)}
                    placeholder={
                      providerStatus?.freeLlmApiHasKey
                        ? `Tersimpan (${providerStatus.freeLlmApiKeyLast4}) — isi untuk ganti`
                        : 'API Key opsional'
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-white"
                  />
                </div>

                <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
                  <div className="font-bold text-amber-300">⚡ n8n Webhook URL</div>
                  <input
                    value={n8nWebhookUrl}
                    onChange={(e) => setN8nWebhookUrl(e.target.value)}
                    placeholder="http://localhost:5678"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-white"
                  />
                </div>

                <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
                  <div className="font-bold text-violet-300">🎙️ Voicebox TTS Server (Port 17493)</div>
                  <input
                    value={voiceboxUrl}
                    onChange={(e) => setVoiceboxUrl(e.target.value)}
                    placeholder="http://127.0.0.1:17493"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
                  <div className="font-bold text-rose-300">📺 YouTube Upload Credentials</div>
                  <input
                    value={youtubeChannel}
                    onChange={(e) => setYoutubeChannel(e.target.value)}
                    placeholder="Channel handle / ID (menunggu kredensial)"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-white"
                  />
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      value={youtubeClientId}
                      onChange={(e) => setYoutubeClientId(e.target.value)}
                      placeholder={providerStatus?.youtubeClientIdLast4 || 'OAuth Client ID'}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-white"
                    />
                    <input
                      type="password"
                      value={youtubeClientSecret}
                      onChange={(e) => setYoutubeClientSecret(e.target.value)}
                      placeholder={providerStatus?.youtubeHasSecret ? 'Secret tersimpan' : 'OAuth Client Secret'}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-white"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
                  <div className="font-bold text-fuchsia-300">🎞️ Concat / FFmpeg &amp; Remotion</div>
                  <div className="mt-1 text-[11px] text-slate-300">
                    Remotion: <span className="font-bold text-fuchsia-200">Khusus Yang Mulia (Use-Only)</span>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500">
                    13 skill <code>remotion-*</code> dan <code>viral-script-architect</code> tidak untuk redistribusi publik.
                  </p>
                </div>
              </div>

              {providerMsg && (
                <div className="rounded-lg bg-slate-950 px-3 py-2 text-[11px] text-emerald-300">{providerMsg}</div>
              )}

              <button
                type="submit"
                className="rounded-xl bg-amber-400 px-4 py-2 font-extrabold text-slate-950 hover:bg-amber-300"
              >
                Simpan Konfigurasi Provider ke Server
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
