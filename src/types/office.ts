export type FloorId = 1 | 2 | 3;

export type WorkspaceMode = 'office' | 'content-creator' | 'finance';

export type WorkspaceModalView =
  | 'none'
  | 'group-chat'
  | 'pipeline'
  | 'finance-sandi'
  | 'settings';

export type AgentActionState =
  | 'idle'
  | 'walking'
  | 'typing'
  | 'thinking'
  | 'coffee'
  | 'celebrating'
  | 'elevator_wait'
  | 'elevator_ride';

export interface MuseEventPayload {
  agentId: string;
  action: 'idle' | 'thinking' | 'typing' | 'success' | 'coffee' | 'walking';
  targetRoom: string;
  statusText: string;
  nextAgent?: string;
}

export interface AgentScheduleStep {
  roomId: string;
  task: string;
  action: AgentActionState;
  dwell: number;
  faceUp?: boolean;
  faceLeft?: boolean;
}

export interface SpriteCellRef {
  col: number;
  row: number;
}

export interface MuseAgentConfig {
  id: string;
  agentNumber: number | null;
  code: string;
  emoji: string;
  name: string;
  title: string;
  role: string;
  department: 'KRA_CORE' | 'FINANCE';
  modes: WorkspaceMode[];
  reportsTo: string;
  manages?: string[];
  inGroupChat: boolean;
  vibe: string;
  personaStyle: string;
  traits: string[];
  skills: string[];
  houseRules?: string[];
  approvalGate?: string;
  notes?: string;
  color: number;
  homeFloor: FloorId;
  homeRoom: string;
  useDeskTypingPose?: boolean;
  sprites: {
    front: SpriteCellRef[];
    back: SpriteCellRef[];
    typing: SpriteCellRef[];
    coffee: SpriteCellRef[];
    celebrate: SpriteCellRef[];
  };
  schedule: AgentScheduleStep[];
}

export interface AgentRuntimeSnapshot {
  id: string;
  agentNumber: number | null;
  code: string;
  emoji: string;
  name: string;
  title: string;
  role: string;
  department: 'KRA_CORE' | 'FINANCE';
  modes: WorkspaceMode[];
  reportsTo: string;
  inGroupChat: boolean;
  skills: string[];
  colorHex: string;
  floor: FloorId;
  currentRoom: string;
  action: AgentActionState;
  task: string;
  progressPct: number;
  screenX: number;
  screenY: number;
  visibleOnScreen: boolean;
  isElevatorRiding: boolean;
}

export interface NavNode {
  id: string;
  u: number;
  v: number;
  neighbors: string[];
  allowedFloors?: FloorId[];
}

export interface RoomDefinition {
  id: string;
  label: string;
  floor: FloorId;
  u: number;
  v: number;
  navNodeId: string;
  faceUp?: boolean;
  faceLeft?: boolean;
}

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  floor: FloorId;
  action: string;
  message: string;
  payloadJson?: string;
}

export interface MarketTickerSnapshot {
  btcPrice: number | null;
  btcChangePct: number | null;
  btcUp: boolean | null;
  btcIsLive: boolean;
  exnessDemoConfigured: boolean;
  exnessRealConfigured: boolean;
  demoBalance: number | null;
  demoCurrency: string | null;
  realBalance: number | null;
  realCurrency: string | null;
}

export interface RoomZoneSpec {
  zoneId: string;
  label: string;
  floor: FloorId;
  polygonUV: Array<[number, number]>;
  doorSensors: Array<{ u: number; v: number }>;
  roomIds: string[];
  slidingDoor?: { u: number; v: number; flipX?: boolean; floors?: FloorId[] };
}

export interface RoomZoneRuntimeStatus {
  zoneId: string;
  label: string;
  floor: FloorId;
  revealed: boolean;
  doorOpen: boolean;
  occupants: string[];
}

export interface ShotcraftPreviewData {
  title: string;
  component: string;
  durationMs: number;
  staggerMs: number;
  pattern: string;
}

export interface GroupChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  emoji: string;
  colorHex: string;
  text: string;
  timestamp: string;
  source?: string;
}

export type PipelineStageId =
  | 'ide'
  | 'naskah'
  | 'approval_yang_mulia'
  | 'edit_raga'
  | 'qa_meimei'
  | 'siap_terbit'
  | 'komunitas_fizi';

export interface PipelineProjectItem {
  id: string;
  topic: string;
  stage: PipelineStageId;
  scriptApprovedByYangMulia: boolean;
  meimeiVerdict: 'PENDING' | 'PASS' | 'REVISE' | 'INCOMPLETE';
  qaNotes: string;
  useVoicebox: boolean;
  remotionRestrictedNote: boolean;
  createdAt: string;
}

export interface ExnessProfileStatus {
  profile: 'demo' | 'real';
  configured: boolean;
  source: 'env' | 'store' | 'unconfigured';
  apiKeyLast4: string | null;
  accountIdMasked: string | null;
  discoveryBaseUrl: string | null;
  expiryDate: string | null;
}

export interface ExnessConnectivityReport {
  profile: 'demo' | 'real';
  selfTest: {
    passedCount: number;
    totalCount: number;
    allPassed: boolean;
    checks: Array<{ name: string; pass: boolean }>;
  };
  discovery: {
    status: 'PASS' | 'FAIL';
    accessPoint?: string;
    fromCache?: boolean;
    message?: string;
  };
  accountDetails: {
    status: 'PASS' | 'FAIL' | 'SKIP';
    currency?: string | null;
    leverage?: number | null;
    marginCall?: number | null;
    stopOut?: number | null;
    balance?: number | null;
    equity?: number | null;
    margin?: number | null;
    freeMargin?: number | null;
    fetchedAt?: string;
    message?: string;
  };
}
