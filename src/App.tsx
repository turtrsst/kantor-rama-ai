import { useCallback, useEffect, useRef, useState } from 'react';
import { AgentConsoleModal } from './components/AgentConsoleModal';
import { AgentFloatingBubbles } from './components/AgentFloatingBubbles';
import { BottomRoster } from './components/BottomRoster';
import { EditorDrawer } from './components/EditorDrawer';
import { ExnessStatusState, FinanceConsoleModal } from './components/FinanceConsoleModal';
import { GroupChatDrawer } from './components/GroupChatDrawer';
import { MuseCommandDrawer } from './components/MuseCommandDrawer';
import { PipelineBoardModal } from './components/PipelineBoardModal';
import { SettingsModal } from './components/SettingsModal';
import { ShotcraftModal } from './components/ShotcraftModal';
import { TopHud } from './components/TopHud';
import { FurnitureCatalogItem, OfficeEngine } from './game/OfficeEngine';
import { WallPieceCatalog } from './game/spriteLoader';
import {
  ActivityLogEntry,
  AgentRuntimeSnapshot,
  FloorId,
  MarketTickerSnapshot,
  MuseEventPayload,
  PipelineProjectItem,
  RoomZoneRuntimeStatus,
  WorkspaceModalView,
  WorkspaceMode
} from './types/office';

const INITIAL_MARKETS: MarketTickerSnapshot = {
  btcPrice: null,
  btcChangePct: null,
  btcUp: null,
  btcIsLive: false,
  exnessDemoConfigured: false,
  exnessRealConfigured: false,
  demoBalance: null,
  demoCurrency: null,
  realBalance: null,
  realCurrency: null
};

const PIPELINE_STORAGE_KEY = 'kra_pipeline_v1';

export function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<OfficeEngine | null>(null);

  const [currentFloor, setCurrentFloor] = useState<FloorId>(1);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('office');
  const [activeModal, setActiveModal] = useState<WorkspaceModalView>('none');
  const [inspectedAgentId, setInspectedAgentId] = useState<string | null>(null);

  const [agents, setAgents] = useState<AgentRuntimeSnapshot[]>([]);
  const [roomZones, setRoomZones] = useState<RoomZoneRuntimeStatus[]>([]);
  const [markets, setMarkets] = useState<MarketTickerSnapshot>(INITIAL_MARKETS);
  const [exnessStatus, setExnessStatus] = useState<ExnessStatusState | null>(null);

  const [pipelineItems, setPipelineItems] = useState<PipelineProjectItem[]>(() => {
    try {
      const saved = localStorage.getItem(PIPELINE_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as PipelineProjectItem[]) : [];
    } catch {
      return [];
    }
  });

  const [editMode, setEditMode] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [museDrawerOpen, setMuseDrawerOpen] = useState(false);
  const [shotcraftOpen, setShotcraftOpen] = useState(false);
  const [doorsForcedOpen, setDoorsForcedOpen] = useState(false);
  const [cutawayEnabled, setCutawayEnabled] = useState(true);
  const [followAgentId, setFollowAgentId] = useState<string | null>(null);

  const [furnitureCatalog, setFurnitureCatalog] = useState<FurnitureCatalogItem[]>([]);
  const [wallCatalog, setWallCatalog] = useState<WallPieceCatalog[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
  const [selectionHint, setSelectionHint] = useState(
    'MODE EDIT: Klik & Drag furnitur/dinding (Snap Grid aktif), R untuk flip, Del untuk bongkar.'
  );
  const [hasPlacedSelection, setHasPlacedSelection] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(PIPELINE_STORAGE_KEY, JSON.stringify(pipelineItems));
    } catch {
      // ignore storage quota
    }
  }, [pipelineItems]);

  const refreshExnessStatus = useCallback(async () => {
    try {
      const resp = await fetch('/api/exness/status');
      if (!resp.ok) return;
      const data = (await resp.json()) as ExnessStatusState;
      setExnessStatus(data);
      engineRef.current?.refreshExnessStatus();
    } catch {
      // server offline / unreachable
    }
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new OfficeEngine(container, {
      onFloorChange: (f) => setCurrentFloor(f),
      onAgentsUpdate: (list) => setAgents(list),
      onRoomZonesUpdate: (zones) => setRoomZones(zones),
      onMarketsUpdate: (m) => setMarkets(m),
      onCatalogReady: (furn, walls) => {
        setFurnitureCatalog([...furn]);
        setWallCatalog([...walls]);
      },
      onSelectionHint: (hint, hasSelection) => {
        setSelectionHint(hint);
        setHasPlacedSelection(hasSelection);
      },
      onActivityLog: (entry) => {
        setActivityLogs((prev) => [entry, ...prev].slice(0, 40));
      },
      onAgentClick: (agentId) => {
        setFollowAgentId(agentId);
        setInspectedAgentId(agentId);
      }
    });

    engineRef.current = engine;
    void refreshExnessStatus();

    // Real BTC/USDT live stream (no fake fallback if disconnected)
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@ticker');
      ws.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          const price = Number(payload.c);
          if (Number.isFinite(price) && price > 0) {
            engine.ingestBtcPrice(price);
          }
        } catch {
          // ignore malformed ticker
        }
      };
    } catch {
      // stay in honest BELUM DIAMBIL state
    }

    return () => {
      try {
        ws?.close();
      } catch {
        // ignore
      }
      engine.dispose();
      engineRef.current = null;
    };
  }, [refreshExnessStatus]);

  const handleSwitchFloor = useCallback((f: FloorId) => {
    setFollowAgentId(null);
    engineRef.current?.setFollowAgent(null);
    engineRef.current?.switchFloor(f);
  }, []);

  const handleChangeMode = useCallback(
    (mode: WorkspaceMode) => {
      setWorkspaceMode(mode);
      if (mode === 'office') {
        setActiveModal('none');
      } else if (mode === 'content-creator') {
        if (currentFloor === 3) {
          handleSwitchFloor(1);
        }
        setActiveModal('pipeline');
      } else if (mode === 'finance') {
        handleSwitchFloor(3);
        setActiveModal('finance-sandi');
      }
    },
    [currentFloor, handleSwitchFloor]
  );

  const handleOpenModal = useCallback(
    (view: WorkspaceModalView) => {
      setActiveModal((prev) => (prev === view ? 'none' : view));
      if (view === 'finance-sandi') {
        handleSwitchFloor(3);
      }
    },
    [handleSwitchFloor]
  );

  const handleToggleEditMode = useCallback(() => {
    setEditMode((prev) => {
      const next = !prev;
      engineRef.current?.setEditMode(next);
      if (next) {
        setMuseDrawerOpen(false);
        setActiveModal('none');
      } else {
        setSelectedCatalogId(null);
      }
      return next;
    });
  }, []);

  const handleToggleMuseDrawer = useCallback(() => {
    setMuseDrawerOpen((prev) => {
      const next = !prev;
      if (next) {
        setEditMode(false);
        engineRef.current?.setEditMode(false);
        setSelectedCatalogId(null);
      }
      return next;
    });
  }, []);

  const handleToggleSnapToGrid = useCallback(() => {
    setSnapToGrid((prev) => {
      const next = !prev;
      engineRef.current?.setSnapToGrid(next);
      return next;
    });
  }, []);

  const handleToggleCutaway = useCallback(() => {
    setCutawayEnabled((prev) => {
      const next = !prev;
      engineRef.current?.setCutawayEnabled(next);
      return next;
    });
  }, []);

  const handleSelectFurniture = useCallback((item: FurnitureCatalogItem | null) => {
    setSelectedCatalogId(item ? item.id : null);
    engineRef.current?.selectFurnitureToPlace(item);
  }, []);

  const handleSelectWall = useCallback((piece: WallPieceCatalog | null) => {
    setSelectedCatalogId(piece ? piece.id : null);
    engineRef.current?.selectWallToPlace(piece);
  }, []);

  const handleSelectAgent = useCallback((agentId: string) => {
    if (!agentId) {
      setFollowAgentId(null);
      engineRef.current?.setFollowAgent(null);
      return;
    }
    setFollowAgentId(agentId);
    engineRef.current?.focusAgent(agentId);
  }, []);

  const handleRunPipeline = useCallback((brief: string) => {
    engineRef.current?.triggerMusePipelineRelay(brief);
  }, []);

  const handleDispatchEvent = useCallback((payload: MuseEventPayload, autoRelay = true) => {
    return engineRef.current?.dispatchMuseEvent(payload, autoRelay) ?? false;
  }, []);

  const handleAccountSnapshotReceived = useCallback(
    (profile: 'demo' | 'real', balance: number | null, currency: string | null) => {
      engineRef.current?.setExnessAccountSnapshot(profile, balance, currency);
    },
    []
  );

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#141923]">
      {/* 2.5D Isometric Three.js Canvas */}
      <div ref={mountRef} className="h-full w-full" />

      {/* Floating RimWorld-style Agent Badges */}
      <AgentFloatingBubbles agents={agents} />

      {/* Top KRA Studio, Mode Switcher & Honest Telemetry HUD */}
      <TopHud
        currentFloor={currentFloor}
        onSwitchFloor={handleSwitchFloor}
        workspaceMode={workspaceMode}
        onChangeMode={handleChangeMode}
        activeModal={activeModal}
        onOpenModal={handleOpenModal}
        pipelineCount={pipelineItems.length}
        markets={markets}
        editMode={editMode}
        onToggleEditMode={handleToggleEditMode}
        museDrawerOpen={museDrawerOpen}
        onToggleMuseDrawer={handleToggleMuseDrawer}
        doorsForcedOpen={doorsForcedOpen}
        onToggleDoors={() => {
          const next = engineRef.current?.toggleElevatorDoors() ?? false;
          setDoorsForcedOpen(next);
        }}
        cutawayEnabled={cutawayEnabled}
        onToggleCutaway={handleToggleCutaway}
        onOpenShotcraft={() => setShotcraftOpen(true)}
        onResetCamera={() => engineRef.current?.resetCamera()}
        activeAgentCount={agents.length}
        roomZones={roomZones}
      />

      {/* Left Modular Furniture, Tiles & Cutaway Wall Editor Drawer */}
      <EditorDrawer
        open={editMode}
        onClose={() => {
          setEditMode(false);
          engineRef.current?.setEditMode(false);
          setSelectedCatalogId(null);
        }}
        furnitureCatalog={furnitureCatalog}
        wallCatalog={wallCatalog}
        selectedItemId={selectedCatalogId}
        onSelectFurniture={handleSelectFurniture}
        onSelectWall={handleSelectWall}
        selectionHint={selectionHint}
        hasPlacedSelection={hasPlacedSelection}
        snapToGrid={snapToGrid}
        onToggleSnapToGrid={handleToggleSnapToGrid}
        onClearWallsFloor={() => engineRef.current?.clearWallsOnCurrentFloor()}
        onFlip={() => engineRef.current?.flipCurrentItem()}
        onDelete={() => engineRef.current?.deleteSelectedItem()}
        onCopyJson={() => engineRef.current?.exportLayoutJson() ?? '{}'}
        onResetDefault={() => engineRef.current?.resetDefaultLayout()}
      />

      {/* Right KRA Command & JSON/WebSocket Bridge Drawer */}
      <MuseCommandDrawer
        open={museDrawerOpen}
        onClose={() => setMuseDrawerOpen(false)}
        onRunPipeline={handleRunPipeline}
        onDispatchEvent={handleDispatchEvent}
        onOpenShotcraft={() => setShotcraftOpen(true)}
        activityLogs={activityLogs}
      />

      {/* Group Chat "Kantor KRA" (8 Agen Inti KRA ONLY) */}
      <GroupChatDrawer
        open={activeModal === 'group-chat'}
        onClose={() => setActiveModal('none')}
        onDispatchEvent={handleDispatchEvent}
      />

      {/* Content Creator 7-Stage Pipeline Board (PUTRI & MEIMEI Gates) */}
      <PipelineBoardModal
        open={activeModal === 'pipeline'}
        onClose={() => setActiveModal('none')}
        items={pipelineItems}
        setItems={setPipelineItems}
        onDispatchEvent={handleDispatchEvent}
      />

      {/* Divisi Finance Standalone Console (SANDI, MAEL, JARJIT + Exness Read-Only) */}
      <FinanceConsoleModal
        open={activeModal === 'finance-sandi'}
        onClose={() => setActiveModal('none')}
        exnessStatus={exnessStatus}
        onRefreshExnessStatus={refreshExnessStatus}
        onAccountSnapshotReceived={handleAccountSnapshotReceived}
        onOpenSettings={() => setActiveModal('settings')}
        onDispatchEvent={handleDispatchEvent}
      />

      {/* Settings (Exness DEMO/REAL + 9router + freellmapi + n8n + Voicebox + YouTube) */}
      <SettingsModal
        open={activeModal === 'settings'}
        onClose={() => setActiveModal('none')}
        exnessStatus={exnessStatus}
        onRefreshExnessStatus={refreshExnessStatus}
      />

      {/* Individual Agent Console Modal (via Canvas Click or Roster Inspect) */}
      <AgentConsoleModal
        agentId={inspectedAgentId}
        onClose={() => setInspectedAgentId(null)}
        onDispatchEvent={handleDispatchEvent}
        onOpenFinance={() => {
          setInspectedAgentId(null);
          handleChangeMode('finance');
        }}
        onOpenGroupChat={() => {
          setInspectedAgentId(null);
          setActiveModal('group-chat');
        }}
      />

      {/* Video-Shotcraft Motion Studio Modal */}
      <ShotcraftModal open={shotcraftOpen} onClose={() => setShotcraftOpen(false)} />

      {/* Bottom 11-Agent KRA & Finance Roster Bar */}
      <BottomRoster
        agents={agents}
        followAgentId={followAgentId}
        onSelectAgent={handleSelectAgent}
        onInspectAgent={(id) => setInspectedAgentId(id)}
      />
    </div>
  );
}

export default App;
