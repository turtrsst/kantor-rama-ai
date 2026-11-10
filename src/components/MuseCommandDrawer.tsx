import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Clapperboard,
  Code2,
  Coffee,
  PartyPopper,
  Play,
  Plug,
  Send,
  Sparkles,
  Unplug,
  X
} from 'lucide-react';
import { AGENTS_CATALOG } from '../data/agentsCatalog';
import { ROOM_DEFINITIONS } from '../data/floorNavGraph';
import { ActivityLogEntry, MuseEventPayload } from '../types/office';

type DrawerTab = 'pipeline' | 'json' | 'logs';

interface MuseCommandDrawerProps {
  open: boolean;
  onClose: () => void;
  onRunPipeline: (brief: string) => void;
  onDispatchEvent: (payload: MuseEventPayload, autoRelay?: boolean) => boolean;
  onOpenShotcraft: () => void;
  activityLogs: ActivityLogEntry[];
}

const DEFAULT_JSON_SAMPLE: MuseEventPayload = {
  agentId: 'raga',
  action: 'typing',
  targetRoom: 'Floor2_DesignDesk',
  statusText: 'Video Assembly & Voicebox TTS (Remotion khusus Yang Mulia)',
  nextAgent: 'meimei'
};

export const MuseCommandDrawer: React.FC<MuseCommandDrawerProps> = ({
  open,
  onClose,
  onRunPipeline,
  onDispatchEvent,
  onOpenShotcraft,
  activityLogs
}) => {
  const [tab, setTab] = useState<DrawerTab>('pipeline');
  const [brief, setBrief] = useState('Kantor KRA 2.5D + Workflow Content Creator & Finance');
  const [quickAgent, setQuickAgent] = useState('putri');
  const [quickAction, setQuickAction] = useState<MuseEventPayload['action']>('typing');
  const [quickRoom, setQuickRoom] = useState('Floor1_Desk2');
  const [quickStatus, setQuickStatus] = useState('Menulis naskah & 5 hook (tunggu Approval Yang Mulia)');
  const [jsonText, setJsonText] = useState(JSON.stringify(DEFAULT_JSON_SAMPLE, null, 2));
  const [jsonStatus, setJsonStatus] = useState<string | null>(null);

  // Live WebSocket Bridge ready for Muse README-INTEGRASI.md
  const [wsUrl, setWsUrl] = useState('ws://localhost:8080/muse-events');
  const [wsConnected, setWsConnected] = useState(false);
  const [wsMessage, setWsMessage] = useState('Siap sambungkan ke Muse CLI / WebSocket Bridge');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    return () => {
      try {
        wsRef.current?.close();
      } catch {
        // ignore
      }
    };
  }, []);

  if (!open) return null;

  const handleQuickDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    onDispatchEvent(
      {
        agentId: quickAgent,
        action: quickAction,
        targetRoom: quickRoom,
        statusText: quickStatus || `Running ${quickAction}`
      },
      false
    );
  };

  const handleJsonSend = () => {
    try {
      const parsed = JSON.parse(jsonText) as MuseEventPayload;
      if (!parsed.agentId || !parsed.action || !parsed.targetRoom) {
        setJsonStatus('Harus memiliki agentId, action, dan targetRoom.');
        return;
      }
      const ok = onDispatchEvent(parsed, true);
      setJsonStatus(
        ok
          ? `Event diterima & dijalankan oleh ${parsed.agentId}!`
          : `Agent "${parsed.agentId}" tidak ditemukan di roster.`
      );
    } catch {
      setJsonStatus('JSON tidak valid — cek tanda kutip dan koma.');
    }
  };

  const toggleWebSocket = () => {
    if (wsConnected && wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setWsConnected(false);
      setWsMessage('Koneksi WebSocket ditutup.');
      return;
    }

    try {
      const sock = new WebSocket(wsUrl);
      wsRef.current = sock;
      setWsMessage('Menghubungkan...');
      sock.onopen = () => {
        setWsConnected(true);
        setWsMessage(`Terhubung ke ${wsUrl}`);
      };
      sock.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data) as MuseEventPayload;
          if (payload.agentId) onDispatchEvent(payload, true);
        } catch {
          setWsMessage('Payload WS bukan JSON valid.');
        }
      };
      sock.onerror = () => {
        setWsConnected(false);
        setWsMessage('Gagal terhubung — gunakan Simulasi JSON di bawah.');
      };
      sock.onclose = () => {
        setWsConnected(false);
      };
    } catch {
      setWsConnected(false);
      setWsMessage('URL WebSocket tidak valid.');
    }
  };

  const triggerCoffeeBreak = () => {
    ['rama', 'putri', 'meimei', 'sandi'].forEach((id, idx) => {
      onDispatchEvent(
        {
          agentId: id,
          action: 'coffee',
          targetRoom: idx % 2 === 0 ? 'Floor1_Pantry' : 'Floor3_Lounge',
          statusText: 'Espresso Recharge Break'
        },
        false
      );
    });
  };

  const triggerCelebration = () => {
    ['rama', 'raga', 'aruna', 'mael'].forEach((id) => {
      onDispatchEvent(
        {
          agentId: id,
          action: 'success',
          targetRoom: 'Floor1_BossRoom',
          statusText: 'KRA Pipeline Siap Terbit & Finance Check OK!'
        },
        false
      );
    });
  };

  return (
    <aside className="fixed bottom-16 right-4 top-16 z-30 flex w-96 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-violet-400/35 bg-slate-900/95 shadow-2xl backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/20 text-violet-300">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-extrabold tracking-wide text-slate-100">
              KRA COMMAND &amp; EVENT BRIDGE
            </h3>
            <p className="text-[10px] text-slate-400">
              Brief Studio • KRA Relay • JSON / WS Simulator
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 border-b border-slate-800 bg-slate-950/60 p-1 text-[11px] font-bold">
        <button
          onClick={() => setTab('pipeline')}
          className={`flex items-center justify-center gap-1 rounded-lg py-1.5 transition ${
            tab === 'pipeline' ? 'bg-violet-500 text-slate-950' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Play className="h-3.5 w-3.5" />
          Brief &amp; Relay
        </button>
        <button
          onClick={() => setTab('json')}
          className={`flex items-center justify-center gap-1 rounded-lg py-1.5 transition ${
            tab === 'json' ? 'bg-sky-400 text-slate-950' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Code2 className="h-3.5 w-3.5" />
          JSON / WS
        </button>
        <button
          onClick={() => setTab('logs')}
          className={`flex items-center justify-center gap-1 rounded-lg py-1.5 transition ${
            tab === 'logs' ? 'bg-emerald-400 text-slate-950' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Activity className="h-3.5 w-3.5" />
          Log ({activityLogs.length})
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4 text-xs">
        {tab === 'pipeline' && (
          <>
            {/* Brief / Full Relay */}
            <div className="space-y-2 rounded-xl border border-violet-400/25 bg-slate-950/60 p-3">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-violet-300">
                1. Kirim Brief ke RAMA (CEO KRA)
              </label>
              <textarea
                rows={2}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="Masukkan topik video / brief untuk Kantor KRA..."
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-violet-400 focus:outline-none"
              />
              <button
                onClick={() => onRunPipeline(brief)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-400 to-fuchsia-400 py-2 text-xs font-extrabold text-slate-950 shadow hover:brightness-110"
              >
                <Play className="h-3.5 w-3.5" />
                Jalankan KRA Relay (RAMA → PUTRI → RAGA → MEIMEI → ARUNA)
              </button>
              <p className="text-[10px] leading-relaxed text-slate-400">
                Agen akan berjalan melewati pintu ruangan, naik Central Lift antar Lantai 1–2, mengetik di meja, hingga tahap Siap Terbit.
              </p>
            </div>

            {/* Quick Presets */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={triggerCoffeeBreak}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-500/10 py-2 text-[11px] font-bold text-amber-300 hover:bg-amber-500/20"
              >
                <Coffee className="h-3.5 w-3.5" />
                Coffee Break Tim
              </button>
              <button
                onClick={triggerCelebration}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-500/10 py-2 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/20"
              >
                <PartyPopper className="h-3.5 w-3.5" />
                Selebrasi Launch!
              </button>
            </div>

            <button
              onClick={onOpenShotcraft}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-fuchsia-400/40 bg-fuchsia-500/15 py-2 text-[11px] font-bold text-fuchsia-300 hover:bg-fuchsia-500/25"
            >
              <Clapperboard className="h-3.5 w-3.5" />
              Shotcraft Preview (RAGA — Remotion Khusus Yang Mulia)
            </button>

            {/* Single Agent Command */}
            <form
              onSubmit={handleQuickDispatch}
              className="space-y-2.5 rounded-xl border border-slate-800 bg-slate-950/60 p-3"
            >
              <div className="text-[11px] font-bold uppercase tracking-wider text-sky-300">
                2. Perintah Agent Spesifik (Cross-Floor)
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] text-slate-400">Agent</label>
                  <select
                    value={quickAgent}
                    onChange={(e) => setQuickAgent(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px] text-slate-100"
                  >
                    {AGENTS_CATALOG.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} • {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[10px] text-slate-400">Aksi / Animasi</label>
                  <select
                    value={quickAction}
                    onChange={(e) => setQuickAction(e.target.value as MuseEventPayload['action'])}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px] text-slate-100"
                  >
                    <option value="typing">Typing (Duduk Kerja)</option>
                    <option value="thinking">Thinking (Analisis)</option>
                    <option value="coffee">Coffee Break</option>
                    <option value="success">Success (Konfeti)</option>
                    <option value="idle">Idle / Standby</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[10px] text-slate-400">Ruangan Tujuan</label>
                <select
                  value={quickRoom}
                  onChange={(e) => setQuickRoom(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px] text-slate-100"
                >
                  {Object.values(ROOM_DEFINITIONS).map((r) => (
                    <option key={r.id} value={r.id}>
                      L{r.floor} — {r.label} ({r.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[10px] text-slate-400">Status Task</label>
                <input
                  value={quickStatus}
                  onChange={(e) => setQuickStatus(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] text-slate-100"
                />
              </div>

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-sky-400 py-1.5 text-xs font-extrabold text-slate-950 hover:bg-sky-300"
              >
                <Send className="h-3.5 w-3.5" />
                Kirim ke Ruangan
              </button>
            </form>
          </>
        )}

        {tab === 'json' && (
          <>
            {/* WebSocket Bridge */}
            <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                  Muse WebSocket Bridge
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold ${
                    wsConnected ? 'bg-emerald-400/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {wsConnected ? 'CONNECTED' : 'STANDBY'}
                </span>
              </div>
              <div className="flex gap-1.5">
                <input
                  value={wsUrl}
                  onChange={(e) => setWsUrl(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-[11px] text-slate-200"
                />
                <button
                  onClick={toggleWebSocket}
                  className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-bold ${
                    wsConnected
                      ? 'bg-rose-500/20 text-rose-300'
                      : 'bg-emerald-400 text-slate-950'
                  }`}
                >
                  {wsConnected ? <Unplug className="h-3.5 w-3.5" /> : <Plug className="h-3.5 w-3.5" />}
                  {wsConnected ? 'Putus' : 'Connect'}
                </button>
              </div>
              <p className="text-[10px] text-slate-400">{wsMessage}</p>
            </div>

            {/* JSON Event Simulator */}
            <div className="space-y-2 rounded-xl border border-sky-400/25 bg-slate-950/60 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-sky-300">
                  JSON Event Payload Simulator
                </span>
                <button
                  onClick={() => {
                    setJsonText(
                      JSON.stringify(
                        {
                          agentId: 'sandi',
                          action: 'typing',
                          targetRoom: 'Floor3_TradingPit',
                          statusText: 'Analisa Market Brief & Watchlist (No Advice)',
                          nextAgent: 'mael'
                        },
                        null,
                        2
                      )
                    );
                  }}
                  className="text-[10px] font-semibold text-sky-400 hover:underline"
                >
                  Preset Finance
                </button>
              </div>

              <textarea
                rows={8}
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2.5 font-mono text-[11px] leading-relaxed text-sky-200 focus:border-sky-400 focus:outline-none"
              />

              {jsonStatus && (
                <div className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-[10px] text-emerald-300">
                  {jsonStatus}
                </div>
              )}

              <button
                onClick={handleJsonSend}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-sky-400 py-2 text-xs font-extrabold text-slate-950 hover:bg-sky-300"
              >
                <Send className="h-3.5 w-3.5" />
                Dispatch JSON Event
              </button>
            </div>
          </>
        )}

        {tab === 'logs' && (
          <div className="space-y-2">
            {activityLogs.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-center text-[11px] text-slate-400">
                Belum ada event dispatch manual. Jalankan Brief atau kirim JSON event untuk melihat riwayat real-time.
              </div>
            ) : (
              activityLogs.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/75 p-2.5"
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold text-sky-300">{entry.agentName}</span>
                    <span className="font-mono text-slate-500">
                      L{entry.floor} • {entry.timestamp}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-200">{entry.message}</div>
                  <div className="mt-1 inline-block rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[9px] text-violet-300">
                    action: {entry.action}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
