import React from 'react';
import {
  Briefcase,
  Clapperboard,
  DoorOpen,
  Film,
  Hammer,
  Kanban,
  Layers,
  MessageSquare,
  RotateCcw,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp
} from 'lucide-react';
import {
  FloorId,
  MarketTickerSnapshot,
  RoomZoneRuntimeStatus,
  WorkspaceModalView,
  WorkspaceMode
} from '../types/office';

interface TopHudProps {
  currentFloor: FloorId;
  onSwitchFloor: (f: FloorId) => void;
  workspaceMode: WorkspaceMode;
  onChangeMode: (m: WorkspaceMode) => void;
  activeModal: WorkspaceModalView;
  onOpenModal: (v: WorkspaceModalView) => void;
  pipelineCount: number;
  markets: MarketTickerSnapshot;
  editMode: boolean;
  onToggleEditMode: () => void;
  museDrawerOpen: boolean;
  onToggleMuseDrawer: () => void;
  doorsForcedOpen: boolean;
  onToggleDoors: () => void;
  cutawayEnabled: boolean;
  onToggleCutaway: () => void;
  onOpenShotcraft: () => void;
  onResetCamera: () => void;
  activeAgentCount: number;
  roomZones: RoomZoneRuntimeStatus[];
}

export const TopHud: React.FC<TopHudProps> = ({
  currentFloor,
  onSwitchFloor,
  workspaceMode,
  onChangeMode,
  activeModal,
  onOpenModal,
  pipelineCount,
  markets,
  editMode,
  onToggleEditMode,
  museDrawerOpen,
  onToggleMuseDrawer,
  doorsForcedOpen,
  onToggleDoors,
  cutawayEnabled,
  onToggleCutaway,
  onOpenShotcraft,
  onResetCamera,
  activeAgentCount,
  roomZones
}) => {
  const totalZones = roomZones.length || 9;

  return (
    <header className="pointer-events-none fixed inset-x-0 top-2.5 z-30 flex flex-col gap-1.5 px-3">
      {/* Row 1: Brand + Motto + Workspace Modes + Floor Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-2xl border border-sky-400/30 bg-slate-900/90 px-3 py-1.5 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-2 pr-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-indigo-500 text-xs font-black text-slate-950">
              K
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-1.5 text-xs font-extrabold tracking-wide text-slate-100">
                KANTOR RAMA <span className="text-sky-400">AI</span>
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-300">
                  {activeAgentCount} BOTS • {totalZones} ROOMS
                </span>
              </div>
              <div className="text-[10px] italic text-cyan-300/90">
                &ldquo;kita adalah pemimpi di hidupnya masing-masing&rdquo; — Yang Mulia
              </div>
            </div>
          </div>

          {/* Mode Toggle: Office / Content Creator / Finance (SANDI) */}
          <div className="flex items-center gap-0.5 rounded-xl bg-slate-950/90 p-0.5 text-[10px] font-bold">
            <button
              onClick={() => onChangeMode('office')}
              className={`flex items-center gap-1 rounded-lg px-2 py-1 transition ${
                workspaceMode === 'office'
                  ? 'bg-sky-400 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Briefcase className="h-3 w-3" />
              Office
            </button>
            <button
              onClick={() => onChangeMode('content-creator')}
              className={`flex items-center gap-1 rounded-lg px-2 py-1 transition ${
                workspaceMode === 'content-creator'
                  ? 'bg-emerald-400 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Clapperboard className="h-3 w-3" />
              Creator
            </button>
            <button
              onClick={() => {
                onChangeMode('finance');
                onSwitchFloor(3);
              }}
              className={`flex items-center gap-1 rounded-lg px-2 py-1 transition ${
                workspaceMode === 'finance'
                  ? 'bg-purple-400 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <TrendingUp className="h-3 w-3" />
              Finance
            </button>
          </div>

          {/* Isometric Floor Selector */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-950/80 p-0.5">
            {([
              { id: 1 as FloorId, label: 'L1 KRA HQ' },
              { id: 2 as FloorId, label: 'L2 Studio & QA' },
              { id: 3 as FloorId, label: 'L3 Finance' }
            ]).map((fl) => (
              <button
                key={fl.id}
                onClick={() => onSwitchFloor(fl.id)}
                className={`rounded-lg px-2 py-1 text-[10px] font-bold transition ${
                  currentFloor === fl.id
                    ? 'bg-gradient-to-r from-sky-400 to-indigo-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {fl.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: KRA Workspace Views + 2.5D Controls */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-1 rounded-2xl border border-slate-700/75 bg-slate-900/90 p-1 shadow-2xl backdrop-blur-md">
          <button
            onClick={() => onOpenModal(activeModal === 'group-chat' ? 'none' : 'group-chat')}
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition ${
              activeModal === 'group-chat'
                ? 'bg-sky-400 text-slate-950'
                : 'border border-sky-400/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Chat KRA
          </button>

          <button
            onClick={() => onOpenModal(activeModal === 'pipeline' ? 'none' : 'pipeline')}
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition ${
              activeModal === 'pipeline'
                ? 'bg-emerald-400 text-slate-950'
                : 'border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
            }`}
          >
            <Kanban className="h-3.5 w-3.5" />
            Pipeline ({pipelineCount})
          </button>

          <button
            onClick={() => onOpenModal(activeModal === 'finance-sandi' ? 'none' : 'finance-sandi')}
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition ${
              activeModal === 'finance-sandi'
                ? 'bg-purple-400 text-slate-950'
                : 'border border-purple-400/35 bg-purple-500/15 text-purple-200 hover:bg-purple-500/25'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Finance &amp; Exness
          </button>

          <button
            onClick={() => onOpenModal(activeModal === 'settings' ? 'none' : 'settings')}
            title="Settings (Exness DEMO/REAL, 9router, freellmapi, n8n, Voicebox, YouTube)"
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition ${
              activeModal === 'settings'
                ? 'bg-amber-400 text-slate-950'
                : 'border border-slate-700 bg-slate-800/70 text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Settings</span>
          </button>

          <div className="mx-0.5 h-5 w-px bg-slate-700" />

          <button
            onClick={onToggleMuseDrawer}
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition ${
              museDrawerOpen
                ? 'bg-gradient-to-r from-violet-400 to-fuchsia-400 text-slate-950'
                : 'border border-violet-400/35 bg-violet-500/15 text-violet-200 hover:bg-violet-500/25'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">Relay</span>
          </button>

          <button
            onClick={onOpenShotcraft}
            title="Shotcraft Remotion Preview (khusus Yang Mulia)"
            className="flex items-center gap-1 rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/10 px-2 py-1.5 text-[11px] font-bold text-fuchsia-200 transition hover:bg-fuchsia-500/20"
          >
            <Film className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={onToggleCutaway}
            title="Dynamic Wall Cutaway"
            className={`flex items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-bold transition ${
              cutawayEnabled
                ? 'border border-indigo-400/35 bg-indigo-500/15 text-indigo-200'
                : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={onToggleEditMode}
            title="Edit Modular Furnitur, Tiles & Dinding"
            className={`flex items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-bold transition ${
              editMode
                ? 'bg-emerald-400 text-slate-950'
                : 'border border-emerald-400/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
            }`}
          >
            <Hammer className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={onToggleDoors}
            title="Buka / Tutup Semua Pintu & Lift"
            className={`rounded-xl px-2 py-1.5 transition ${
              doorsForcedOpen ? 'bg-sky-400/25 text-sky-200' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <DoorOpen className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={onResetCamera}
            title="Reset Kamera"
            className="rounded-xl px-2 py-1.5 text-slate-300 transition hover:bg-slate-800"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Row 2: Honest Live Read-Only Status Bar (Zero Fake Numbers!) */}
      <div className="pointer-events-auto flex flex-wrap items-center gap-3 self-start rounded-full border border-slate-700/70 bg-slate-950/80 px-3 py-1 font-mono text-[10px] text-slate-300 backdrop-blur-md">
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${markets.btcIsLive ? 'animate-pulse bg-emerald-400' : 'bg-slate-500'}`} />
          <span className="text-slate-400">BTC/USDT:</span>
          {markets.btcPrice !== null ? (
            <span className={markets.btcUp ? 'font-bold text-emerald-400' : 'font-bold text-rose-400'}>
              ${markets.btcPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          ) : (
            <span className="text-amber-300">BELUM DIAMBIL</span>
          )}
        </span>
        <span className="text-slate-700">|</span>
        <span>
          <span className="text-slate-400">EXNESS DEMO:</span>{' '}
          {markets.demoBalance !== null ? (
            <span className="font-bold text-sky-300">
              {markets.demoBalance} {markets.demoCurrency || ''}
            </span>
          ) : (
            <span className={markets.exnessDemoConfigured ? 'text-sky-300' : 'text-slate-400'}>
              {markets.exnessDemoConfigured ? 'Tersimpan (BELUM DIAMBIL)' : 'BELUM DIAMBIL'}
            </span>
          )}
        </span>
        <span className="text-slate-700">|</span>
        <span>
          <span className="text-slate-400">EXNESS REAL (RO):</span>{' '}
          {markets.realBalance !== null ? (
            <span className="font-bold text-emerald-300">
              {markets.realBalance} {markets.realCurrency || ''}
            </span>
          ) : (
            <span className={markets.exnessRealConfigured ? 'text-emerald-300' : 'text-slate-400'}>
              {markets.exnessRealConfigured ? 'Tersimpan (BELUM DIAMBIL)' : 'BELUM DIAMBIL'}
            </span>
          )}
        </span>
      </div>
    </header>
  );
};
