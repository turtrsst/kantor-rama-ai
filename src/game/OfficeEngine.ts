import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AGENTS_CATALOG } from '../data/agentsCatalog';
import {
  FLOOR_NAV_NODES,
  GRID_CELLS,
  ROOM_DEFINITIONS,
  ROOM_ZONES,
  findNearestNavNode,
  findPathBetweenNodes,
  getRoomById,
  gridCellToUV,
  pointInPolygonUV,
  snapWorldToIsoGrid,
  uvToWorld,
  worldToUV
} from '../data/floorNavGraph';
import {
  DEFAULT_OFFICE_LAYOUT,
  ELEVATOR_DOOR_FRAMES_PX,
  FURNITURE_BOXES_PX,
  FURNITURE_CATALOG_DEFS,
  SLIDING_DOOR_FRAMES_PX,
  SpriteSheetKey
} from '../data/furnitureCatalog';
import {
  COMBO_ANIM_LIBRARY,
  InteractionSheetKey,
  resolveAgentFurnitureCombo
} from '../data/interactionCombos';
import { DEFAULT_WALL_LAYOUT, WALL_BBOXES } from '../data/wallsCatalog';
import {
  ActivityLogEntry,
  AgentActionState,
  AgentRuntimeSnapshot,
  FloorId,
  MarketTickerSnapshot,
  MuseAgentConfig,
  MuseEventPayload,
  RoomZoneRuntimeStatus,
  RoomZoneSpec
} from '../types/office';
import { BTCVideotronEngine } from './btcVideotron';
import { ExnessMarketFeed } from './exnessTicker';
import {
  AgentFrameTexture,
  WallPieceCatalog,
  createNormalizedSlidingDoorFrames,
  createSoftContactShadowTexture,
  cropAgentCellClean,
  cropComboSequence,
  cropSpritePixels,
  extractWallSpritesFromSheet,
  loadCrispTexture,
  loadImageElement
} from './spriteLoader';

export interface FurnitureCatalogItem {
  id: string;
  name: string;
  category: 'OFFICE' | 'PANTRY & LOUNGE' | 'LAB & SERVER' | 'PET & DECOR' | 'TILES';
  frames: THREE.Texture[];
  width: number;
  height: number;
  isPet: boolean;
  speed: number;
  fps: number;
  layerBonus?: number;
}

export interface PlacedFurniture {
  uid: string;
  kind: 'furniture';
  itemId: string;
  floor: FloorId;
  origin: THREE.Vector2;
  pos: THREE.Vector2;
  target: THREE.Vector2;
  flipX: boolean;
  mesh: THREE.Mesh;
  shadowMesh?: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  catalog: FurnitureCatalogItem;
}

export interface PlacedWall {
  uid: string;
  kind: 'wall';
  pieceId: string;
  floor: FloorId;
  pos: THREE.Vector2;
  flipX: boolean;
  isCutaway: boolean;
  /** Deterministic outer-perimeter sort index (undefined for interior walls). */
  perimeterIndex?: number;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  piece: WallPieceCatalog;
}

type SelectablePlaced = PlacedFurniture | PlacedWall;
type SelectableCatalog =
  | { kind: 'furniture'; item: FurnitureCatalogItem }
  | { kind: 'wall'; piece: WallPieceCatalog };

interface AgentEntity {
  config: MuseAgentConfig;
  floor: FloorId;
  pos: THREE.Vector2;
  renderPos: THREE.Vector2;
  usingCombo: boolean;
  waypoints: THREE.Vector2[];
  currentRoomId: string;
  targetRoomId: string;
  scheduleIdx: number;
  action: AgentActionState;
  task: string;
  dwellTimer: number;
  dwellDuration: number;
  faceUp: boolean;
  faceLeft: boolean;
  walkPhase: number;
  pendingFloor?: FloorId;
  pendingRoomId?: string;
  pendingAction?: AgentActionState;
  pendingTask?: string;
  pendingNextAgent?: string;
  elevatorStage: 'none' | 'to_lobby' | 'entering' | 'riding' | 'exiting';
  elevatorTimer: number;
  elevatorDoorSide: 'left' | 'right';
  queuedNextAgent?: string;
  mesh: THREE.Mesh;
  shadowMesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  framesFront: AgentFrameTexture[];
  framesBack: AgentFrameTexture[];
  framesTyping: AgentFrameTexture[];
  framesCoffee: AgentFrameTexture[];
  framesCelebrate: AgentFrameTexture[];
}

interface AnimatedDoor {
  floor: FloorId;
  pos: THREE.Vector2;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  currentFrame: number;
}

interface RoomDoorZoneRuntime {
  spec: RoomZoneSpec;
  doorWorldSensors: THREE.Vector2[];
  doorOpen: boolean;
  occupants: string[];
  slidingDoorMesh?: THREE.Mesh;
  slidingDoorMat?: THREE.MeshBasicMaterial;
  slidingDoorWorldPos?: THREE.Vector2;
  slidingDoorFrame: number;
}

export interface EngineCallbacks {
  onFloorChange?: (floor: FloorId) => void;
  onAgentsUpdate?: (snapshots: AgentRuntimeSnapshot[]) => void;
  onMarketsUpdate?: (markets: MarketTickerSnapshot) => void;
  onRoomZonesUpdate?: (zones: RoomZoneRuntimeStatus[]) => void;
  onCatalogReady?: (furniture: FurnitureCatalogItem[], walls: WallPieceCatalog[]) => void;
  onSelectionHint?: (hint: string, hasSelection: boolean) => void;
  onActivityLog?: (entry: ActivityLogEntry) => void;
  onAgentClick?: (agentId: string) => void;
}

const STORAGE_FURNITURE_KEY = 'kra_modular_furniture_v10';
const STORAGE_WALL_KEY = 'kra_modular_walls_v9';

function calcRenderOrder(footY: number, offset = 0): number {
  return Math.round((5.0 - footY) * 100) + offset;
}

export class OfficeEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private viewHeight = 9.4;

  private texFloor1: THREE.Texture;
  private texFloor2: THREE.Texture;
  private texFloor3: THREE.Texture;
  private mapPlane: THREE.Mesh;
  private btcVideotron: BTCVideotronEngine;
  private exnessFeed: ExnessMarketFeed;

  private currentFloor: FloorId = 1;
  private editMode = false;
  private snapToGrid = true;
  private forceOpenDoors = false;
  private cutawayEnabled = true;
  private followAgentId: string | null = null;

  private doors: AnimatedDoor[] = [];
  private elevatorFrames: THREE.Texture[] = [];
  private slidingDoorFrames: THREE.Texture[] = [];
  private roomZones: RoomDoorZoneRuntime[] = [];
  private editGridGroup: THREE.Group;

  private comboAnimations = new Map<string, { frames: AgentFrameTexture[]; fps: number }>();

  public furnitureCatalog: FurnitureCatalogItem[] = [];
  public wallCatalog: WallPieceCatalog[] = [];
  public placedFurniture: PlacedFurniture[] = [];
  public placedWalls: PlacedWall[] = [];
  private agents: AgentEntity[] = [];

  private selectedCatalogToPlace: SelectableCatalog | null = null;
  private selectedPlacedItem: SelectablePlaced | null = null;
  private draggingPlacedItem: SelectablePlaced | null = null;
  private placementFlipX = false;

  private selectionRing: THREE.Mesh;
  private ghostMesh: THREE.Mesh;
  private ghostMat: THREE.MeshBasicMaterial;
  private contactShadowTex: THREE.CanvasTexture;

  private raycaster = new THREE.Raycaster();
  private pointerNDC = new THREE.Vector2();
  private animationFrameId = 0;
  private lastTimeMs = performance.now();
  private lastUiSyncMs = 0;
  private disposed = false;

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x141923);

    const w = Math.max(1, container.clientWidth || window.innerWidth);
    const h = Math.max(1, container.clientHeight || window.innerHeight);
    const aspect = w / h;

    this.camera = new THREE.OrthographicCamera(
      (-this.viewHeight * aspect) / 2,
      (this.viewHeight * aspect) / 2,
      this.viewHeight / 2,
      -this.viewHeight / 2,
      0.1,
      100
    );
    this.camera.position.set(0, 0, 10);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableRotate = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minZoom = 0.75;
    this.controls.maxZoom = 3.2;
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };
    this.controls.addEventListener('start', this.onControlsStart);

    const loader = new THREE.TextureLoader();
    this.texFloor1 = loadCrispTexture(loader, '/assets/Floor_1_pure.jpg');
    this.texFloor2 = loadCrispTexture(loader, '/assets/Floor_2_pure.jpg');
    this.texFloor3 = loadCrispTexture(loader, '/assets/Floor_1_pure.jpg');
    this.contactShadowTex = createSoftContactShadowTexture();

    // PASS 1 — Floor Layer
    this.mapPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 9),
      new THREE.MeshBasicMaterial({ map: this.texFloor1, depthWrite: false })
    );
    this.mapPlane.renderOrder = 0;
    this.scene.add(this.mapPlane);

    // Floor-standing Market Desk holo-terminal reuses the shared soft shadow texture.
    this.btcVideotron = new BTCVideotronEngine(this.scene, this.contactShadowTex);
    this.exnessFeed = new ExnessMarketFeed();
    void this.exnessFeed.refreshStatus();

    this.selectionRing = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.40, 28),
      new THREE.MeshBasicMaterial({ color: 0x4ade80, side: THREE.DoubleSide, depthWrite: false })
    );
    this.selectionRing.scale.set(1, 0.55, 1);
    this.selectionRing.visible = false;
    this.selectionRing.renderOrder = 9998;
    this.scene.add(this.selectionRing);

    this.ghostMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.ghostMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.ghostMat);
    this.ghostMesh.visible = false;
    this.ghostMesh.renderOrder = 9999;
    this.scene.add(this.ghostMesh);

    this.editGridGroup = this.buildEditSnapGrid();
    this.editGridGroup.visible = false;
    this.scene.add(this.editGridGroup);

    this.initElevatorDoors();
    this.initRoomDoorsAndZones();
    this.initAgents();
    this.loadAllSprites();
    this.bindEvents();
    this.exposeGlobals();

    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  /**
   * Builds a crisp isometric snap grid overlay matching the calibrated 4x4
   * pure-floorplate grid (quarter-cell subdivisions) shown during Edit Mode.
   * Cell (0,0) is the white-nook top apex, so every snap line lands on the
   * baked cyan room borders / white tile grid instead of floating in a room.
   */
  private buildEditSnapGrid(): THREE.Group {
    const group = new THREE.Group();
    const majorPts: THREE.Vector3[] = [];
    const minorPts: THREE.Vector3[] = [];

    const gridUV = (dc: number, dr: number) => {
      const { u, v } = gridCellToUV(dc, dr);
      return uvToWorld(u, v);
    };

    const steps = GRID_CELLS * 4; // quarter-cell snap lines across [0 .. GRID_CELLS]
    for (let i = 0; i <= steps; i++) {
      const t = i * 0.25;
      const isMajor = i % 4 === 0;
      const target = isMajor ? majorPts : minorPts;

      const a1 = gridUV(t, 0);
      const a2 = gridUV(t, GRID_CELLS);
      target.push(new THREE.Vector3(a1.x, a1.y, 0.04), new THREE.Vector3(a2.x, a2.y, 0.04));

      const b1 = gridUV(0, t);
      const b2 = gridUV(GRID_CELLS, t);
      target.push(new THREE.Vector3(b1.x, b1.y, 0.04), new THREE.Vector3(b2.x, b2.y, 0.04));
    }

    const minorGeo = new THREE.BufferGeometry().setFromPoints(minorPts);
    const minorMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.22,
      depthWrite: false
    });
    const minorLines = new THREE.LineSegments(minorGeo, minorMat);
    minorLines.renderOrder = 3;
    group.add(minorLines);

    const majorGeo = new THREE.BufferGeometry().setFromPoints(majorPts);
    const majorMat = new THREE.LineBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.58,
      depthWrite: false
    });
    const majorLines = new THREE.LineSegments(majorGeo, majorMat);
    majorLines.renderOrder = 4;
    group.add(majorLines);

    return group;
  }

  private initElevatorDoors() {
    // Floor 1 & 3 (Floor_1_pure.jpg) have 2 baked elevator doors (SW + SE);
    // Floor 2 (Floor_2_pure.jpg) has 1 baked elevator door (SW only — SE panel is solid steel).
    const DOOR_W_F13 = 0.86;
    const DOOR_H_F13 = DOOR_W_F13 * (436 / 250);
    ([1, 3] as FloorId[]).forEach((fl) => {
      this.addElevatorDoorSlot(fl, 0.475, 0.582, DOOR_W_F13, DOOR_H_F13, false);
      this.addElevatorDoorSlot(fl, 0.550, 0.582, DOOR_W_F13, DOOR_H_F13, true);
    });

    const DOOR_W_F2 = 0.78;
    const DOOR_H_F2 = DOOR_W_F2 * (436 / 250);
    this.addElevatorDoorSlot(2, 0.459, 0.556, DOOR_W_F2, DOOR_H_F2, false);
  }

  private addElevatorDoorSlot(
    floor: FloorId,
    u: number,
    v: number,
    w: number,
    h: number,
    flipX: boolean
  ) {
    const pos = uvToWorld(u, v);
    const depthAnchor = uvToWorld(u, v + 0.008);
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      alphaTest: 0.01,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(pos.x, pos.y + h * 0.36, 0.17);
    if (flipX) mesh.scale.x = -1;
    mesh.renderOrder = calcRenderOrder(depthAnchor.y, 2);
    mesh.visible = false;
    this.scene.add(mesh);
    this.doors.push({ floor, pos: depthAnchor, mesh, mat, currentFrame: 0 });
  }

  /**
   * Initializes room occupancy zones + animated Sliding Glass Doors (zero fog occlusion).
   */
  private initRoomDoorsAndZones() {
    const SLIDE_W = 0.94;
    const SLIDE_H = 1.46;

    ROOM_ZONES.forEach((spec) => {
      let slidingDoorMesh: THREE.Mesh | undefined;
      let slidingDoorMat: THREE.MeshBasicMaterial | undefined;
      let slidingDoorWorldPos: THREE.Vector2 | undefined;
      if (spec.slidingDoor) {
        const dp = uvToWorld(spec.slidingDoor.u, spec.slidingDoor.v);
        slidingDoorWorldPos = dp;
        slidingDoorMat = new THREE.MeshBasicMaterial({
          transparent: true,
          alphaTest: 0.01,
          depthWrite: false,
          side: THREE.DoubleSide
        });
        slidingDoorMesh = new THREE.Mesh(new THREE.PlaneGeometry(SLIDE_W, SLIDE_H), slidingDoorMat);
        slidingDoorMesh.position.set(dp.x, dp.y + SLIDE_H * 0.24, 0.15);
        if (spec.slidingDoor.flipX) slidingDoorMesh.scale.x = -1;
        slidingDoorMesh.renderOrder = calcRenderOrder(dp.y, -2);
        slidingDoorMesh.visible = spec.floor === this.currentFloor;
        this.scene.add(slidingDoorMesh);
      }

      this.roomZones.push({
        spec,
        doorWorldSensors: spec.doorSensors.map((s) => uvToWorld(s.u, s.v)),
        doorOpen: false,
        occupants: [],
        slidingDoorMesh,
        slidingDoorMat,
        slidingDoorWorldPos,
        slidingDoorFrame: 0
      });
    });
  }

  private initAgents() {
    AGENTS_CATALOG.forEach((cfg, idx) => {
      const room = getRoomById(cfg.homeRoom) ?? ROOM_DEFINITIONS.Floor1_BossRoom;
      const startPos = uvToWorld(room.u, room.v);
      const jitterX = ((idx % 3) - 1) * 0.16;
      const jitterY = (Math.floor(idx / 3) % 2 === 0 ? 1 : -1) * 0.06;
      startPos.x += jitterX;
      startPos.y += jitterY;

      const mat = new THREE.MeshBasicMaterial({
        transparent: true,
        alphaTest: 0.01,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      this.scene.add(mesh);

      const shadowMat = new THREE.MeshBasicMaterial({
        map: this.contactShadowTex,
        transparent: true,
        opacity: 0.72,
        depthWrite: false
      });
      const shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.22), shadowMat);
      this.scene.add(shadowMesh);

      const firstStep = cfg.schedule[0];
      const entity: AgentEntity = {
        config: cfg,
        floor: cfg.homeFloor,
        pos: startPos,
        renderPos: startPos.clone(),
        usingCombo: false,
        waypoints: [],
        currentRoomId: cfg.homeRoom,
        targetRoomId: cfg.homeRoom,
        scheduleIdx: 0,
        action: firstStep?.action ?? 'idle',
        task: firstStep?.task ?? 'Standby',
        dwellTimer: 2.0 + (idx % 4) * 0.85,
        dwellDuration: firstStep?.dwell ?? 4.0,
        faceUp: !!firstStep?.faceUp,
        faceLeft: !!firstStep?.faceLeft,
        walkPhase: idx * 0.7,
        elevatorStage: 'none',
        elevatorTimer: 0,
        elevatorDoorSide: cfg.homeFloor === 2 || idx % 2 === 0 ? 'left' : 'right',
        mesh,
        shadowMesh,
        mat,
        framesFront: [],
        framesBack: [],
        framesTyping: [],
        framesCoffee: [],
        framesCelebrate: []
      };

      this.agents.push(entity);
    });
  }

  private loadAllSprites() {
    const safeLoad = (url: string) => loadImageElement(url).catch(() => null);

    // 1. Load Furniture, Animated Props, Static Props & Floor Tiles
    Promise.all([
      loadImageElement('/assets/furniture_spritesheet.png'),
      safeLoad('/assets/props_animations.png'),
      safeLoad('/assets/furnitures_animated.png'),
      safeLoad('/assets/more_animated_props.png'),
      safeLoad('/assets/furnitures_static.png'),
      safeLoad('/assets/tileset_floor_wall.png')
    ])
      .then(([furnImg, propsImg, furnAnimImg, moreAnimImg, staticImg, tilesetImg]) => {
        if (this.disposed) return;

        const doorSheet = propsImg ?? furnAnimImg;
        if (doorSheet) {
          this.elevatorFrames = ELEVATOR_DOOR_FRAMES_PX.map(([sx, sy, sw, sh]) =>
            cropSpritePixels(doorSheet, sx, sy, sw, sh, 18, false)
          );
          this.doors.forEach((d) => {
            d.mat.map = this.elevatorFrames[0];
            d.mat.needsUpdate = true;
          });
        }

        if (furnAnimImg) {
          this.slidingDoorFrames = createNormalizedSlidingDoorFrames(
            furnAnimImg,
            SLIDING_DOOR_FRAMES_PX
          );
          this.roomZones.forEach((z) => {
            if (z.slidingDoorMat && this.slidingDoorFrames[0]) {
              z.slidingDoorMat.map = this.slidingDoorFrames[0];
              z.slidingDoorMat.needsUpdate = true;
            }
          });
        }

        const sheetMap: Record<SpriteSheetKey, HTMLImageElement | null> = {
          furniture: furnImg,
          furnitures_animated: furnAnimImg,
          more_animated_props: moreAnimImg,
          furnitures_static: staticImg,
          tileset_floor_wall: tilesetImg
        };

        const boxScale = furnImg.width / 2752;
        const cropFurnBox = (idx: number) => {
          const [x0, y0, x1, y1] = FURNITURE_BOXES_PX[idx];
          const pad = 3;
          return cropSpritePixels(
            furnImg,
            Math.round((x0 - pad) * boxScale),
            Math.round((y0 - pad) * boxScale),
            Math.round((x1 - x0 + 1 + pad * 2) * boxScale),
            Math.round((y1 - y0 + 1 + pad * 2) * boxScale),
            16,
            true
          );
        };

        this.furnitureCatalog = FURNITURE_CATALOG_DEFS.map((def) => {
          const frames: THREE.Texture[] = [];
          const customImg = def.sheet ? sheetMap[def.sheet] : null;

          if (customImg && def.customBoxes && def.customBoxes.length > 0) {
            const sX = customImg.width / 2752;
            const sY = customImg.height / 1536;
            def.customBoxes.forEach(([bx, by, bw, bh]) => {
              frames.push(
                cropSpritePixels(
                  customImg,
                  Math.round(bx * sX),
                  Math.round(by * sY),
                  Math.round(bw * sX),
                  Math.round(bh * sY),
                  16,
                  true
                )
              );
            });
          } else {
            frames.push(cropFurnBox(def.boxIdx));
            if (def.extraBoxIdxs) {
              def.extraBoxIdxs.forEach((ei) => frames.push(cropFurnBox(ei)));
            }
            if (propsImg && def.propsAnimBoxes && !def.isPet) {
              const pScale = propsImg.width / 2752;
              def.propsAnimBoxes.forEach(([px, py, pw, ph]) => {
                frames.push(
                  cropSpritePixels(
                    propsImg,
                    Math.round(px * pScale),
                    Math.round(py * pScale),
                    Math.round(pw * pScale),
                    Math.round(ph * pScale),
                    16,
                    true
                  )
                );
              });
            }
          }

          return {
            id: def.id,
            name: def.name,
            category: def.category,
            frames,
            width: def.w,
            height: def.h,
            isPet: !!def.isPet,
            speed: def.speed ?? 0,
            fps: def.fps ?? 0,
            layerBonus: def.layerBonus
          };
        });

        this.loadDefaultOrSavedFurniture();
        this.callbacks.onCatalogReady?.(this.furnitureCatalog, this.wallCatalog);
      })
      .catch((err) => console.error('Failed loading furniture/props:', err));

    // 2. Load Cleaned Walls Spritesheet + Tileset Studio/Metallic Walls (with Cutaway variants!)
    Promise.all([
      loadImageElement('/assets/walls_spritesheet.png'),
      safeLoad('/assets/tileset_floor_wall.png')
    ])
      .then(([wallsImg, tilesetImg]) => {
        if (this.disposed) return;
        this.wallCatalog = extractWallSpritesFromSheet(wallsImg, tilesetImg);
        this.loadDefaultOrSavedWalls();
        this.callbacks.onCatalogReady?.(this.furnitureCatalog, this.wallCatalog);
      })
      .catch((err) => console.warn('Failed loading walls_spritesheet.png:', err));

    // 3. Load Agents Cleaned Spritesheet + Interactive Agent Combo Sheets
    Promise.all([
      loadImageElement('/assets/agents_cleaned.png'),
      safeLoad('/assets/more_agent_interactions.png'),
      safeLoad('/assets/agent_furniture_interactions.png')
    ])
      .then(([agentsImg, moreInteractImg, agentFurnImg]) => {
        if (this.disposed) return;

        const cache = new Map<string, AgentFrameTexture>();
        const getCell = (col: number, row: number) => {
          const key = `${col}_${row}`;
          let f = cache.get(key);
          if (!f) {
            f = cropAgentCellClean(agentsImg, col, row);
            cache.set(key, f);
          }
          return f;
        };

        this.agents.forEach((a) => {
          a.framesFront = a.config.sprites.front.map((s) => getCell(s.col, s.row));
          a.framesBack = a.config.sprites.back.map((s) => getCell(s.col, s.row));
          a.framesTyping = a.config.sprites.typing.map((s) => getCell(s.col, s.row));
          a.framesCoffee = a.config.sprites.coffee.map((s) => getCell(s.col, s.row));
          a.framesCelebrate = a.config.sprites.celebrate.map((s) => getCell(s.col, s.row));

          if (a.framesFront.length > 0) {
            this.applyAgentFrame(a, a.framesFront[0], false, 0);
          }
        });

        const interactionSheets: Record<InteractionSheetKey, HTMLImageElement | null> = {
          more_agent_interactions: moreInteractImg,
          agent_furniture_interactions: agentFurnImg
        };

        for (const [comboId, def] of Object.entries(COMBO_ANIM_LIBRARY)) {
          const img = interactionSheets[def.sheet];
          if (!img) continue;
          const frames = cropComboSequence(img, def.boxes, def.worldH);
          this.comboAnimations.set(comboId, { frames, fps: def.fps });
        }
      })
      .catch((err) => console.warn('Failed loading agent sprites:', err));
  }

  private applyAgentFrame(
    agent: AgentEntity,
    frame: AgentFrameTexture,
    faceLeft: boolean,
    bob: number,
    anchorPos?: THREE.Vector2
  ) {
    if (agent.mat.map !== frame.texture) {
      agent.mat.map = frame.texture;
      agent.mat.needsUpdate = true;
    }
    const base = anchorPos ?? agent.pos;
    agent.mesh.scale.set((faceLeft ? -1 : 1) * frame.worldW, frame.worldH, 1);
    agent.mesh.position.set(base.x, base.y + frame.worldH * 0.5 + bob, 0.22);
  }

  // =========================================================
  // FURNITURE & WALL MODULAR PLACEMENT + STORAGE
  // =========================================================
  private spawnFurnitureInstance(
    catalog: FurnitureCatalogItem,
    floor: FloorId,
    worldPos: THREE.Vector2,
    flipX = false,
    save = true
  ): PlacedFurniture {
    const mat = new THREE.MeshBasicMaterial({
      map: catalog.frames[0],
      transparent: true,
      alphaTest: 0.01,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(catalog.width, catalog.height), mat);
    const origin = worldPos.clone();
    const pos = worldPos.clone();
    const target = worldPos.clone();

    mesh.position.set(pos.x, pos.y + catalog.height * 0.48, 0.18);
    mesh.scale.x = flipX ? -1 : 1;
    mesh.visible = floor === this.currentFloor;
    mesh.renderOrder = calcRenderOrder(pos.y, catalog.layerBonus ?? 0);
    this.scene.add(mesh);

    let shadowMesh: THREE.Mesh | undefined;
    if (catalog.category !== 'TILES' && catalog.id !== 'audio_eq_pad') {
      const shW = catalog.isPet ? 0.36 : Math.max(0.42, catalog.width * 0.78);
      const shH = catalog.isPet ? 0.17 : Math.max(0.20, catalog.width * 0.30);
      const shMat = new THREE.MeshBasicMaterial({
        map: this.contactShadowTex,
        transparent: true,
        opacity: catalog.isPet ? 0.65 : 0.72,
        depthWrite: false
      });
      shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(shW, shH), shMat);
      shadowMesh.position.set(pos.x, pos.y + 0.02, 0.02);
      shadowMesh.visible = floor === this.currentFloor;
      shadowMesh.renderOrder = calcRenderOrder(pos.y, -4);
      this.scene.add(shadowMesh);
    }

    const instance: PlacedFurniture = {
      uid: `furn_${catalog.id}_${Math.random().toString(36).slice(2, 8)}`,
      kind: 'furniture',
      itemId: catalog.id,
      floor,
      origin,
      pos,
      target,
      flipX,
      mesh,
      shadowMesh,
      mat,
      catalog
    };
    this.placedFurniture.push(instance);
    if (save) this.saveFurnitureToStorage();
    return instance;
  }

  private spawnWallInstance(
    piece: WallPieceCatalog,
    floor: FloorId,
    worldPos: THREE.Vector2,
    flipX = false,
    save = true,
    perimeterIndex?: number
  ): PlacedWall {
    const mat = new THREE.MeshBasicMaterial({
      map: piece.texture,
      transparent: true,
      alphaTest: 0.01,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(piece.width, piece.height), mat);
    mesh.position.set(
      worldPos.x,
      worldPos.y + piece.topAlignOffset + piece.height * (piece.anchorRatio - 0.5),
      0.16
    );
    if (flipX) mesh.scale.x = -1;
    // Back perimeter walls get an explicit left-to-right / back-to-front index,
    // so equal-footY neighbours never swap order and create a jagged seam.
    mesh.renderOrder = calcRenderOrder(worldPos.y, perimeterIndex ?? 0);
    mesh.visible = floor === this.currentFloor;
    this.scene.add(mesh);

    const instance: PlacedWall = {
      uid: `wall_${piece.id}_${Math.random().toString(36).slice(2, 8)}`,
      kind: 'wall',
      pieceId: piece.id,
      floor,
      pos: worldPos.clone(),
      flipX,
      isCutaway: false,
      perimeterIndex,
      mesh,
      mat,
      piece
    };
    this.placedWalls.push(instance);
    if (save) this.saveWallsToStorage();
    return instance;
  }

  private saveFurnitureToStorage() {
    const data = this.placedFurniture.map((f) => {
      const uv = worldToUV(f.origin.x, f.origin.y);
      return {
        itemId: f.itemId,
        floor: f.floor,
        u: Number(uv.u.toFixed(4)),
        v: Number(uv.v.toFixed(4)),
        flipX: f.flipX
      };
    });
    localStorage.setItem(STORAGE_FURNITURE_KEY, JSON.stringify(data));
  }

  private saveWallsToStorage() {
    const data = this.placedWalls.map((w) => {
      const uv = worldToUV(w.pos.x, w.pos.y);
      return {
        pieceId: w.pieceId,
        floor: w.floor,
        u: Number(uv.u.toFixed(4)),
        v: Number(uv.v.toFixed(4)),
        flipX: w.flipX,
        perimeterIndex: w.perimeterIndex
      };
    });
    localStorage.setItem(STORAGE_WALL_KEY, JSON.stringify(data));
  }

  private loadDefaultOrSavedFurniture() {
    this.placedFurniture.forEach((f) => {
      this.scene.remove(f.mesh);
      if (f.shadowMesh) this.scene.remove(f.shadowMesh);
    });
    this.placedFurniture.length = 0;

    let layout = DEFAULT_OFFICE_LAYOUT;
    const raw = localStorage.getItem(STORAGE_FURNITURE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) layout = parsed;
      } catch {
        // ignore invalid storage
      }
    }

    layout.forEach((entry) => {
      const found = this.furnitureCatalog.find((c) => c.id === entry.itemId);
      if (found) {
        this.spawnFurnitureInstance(found, entry.floor, uvToWorld(entry.u, entry.v), !!entry.flipX, false);
      }
    });
  }

  private loadDefaultOrSavedWalls() {
    this.placedWalls.forEach((w) => this.scene.remove(w.mesh));
    this.placedWalls.length = 0;

    let layout = DEFAULT_WALL_LAYOUT;
    const raw = localStorage.getItem(STORAGE_WALL_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) layout = parsed;
      } catch {
        // ignore
      }
    }

    layout.forEach((entry) => {
      const piece = this.wallCatalog.find((w) => w.id === entry.pieceId);
      if (piece) {
        this.spawnWallInstance(
          piece,
          entry.floor,
          uvToWorld(entry.u, entry.v),
          !!entry.flipX,
          false,
          entry.perimeterIndex
        );
      }
    });
  }

  // =========================================================
  // PUBLIC CONTROLS FOR REACT UI
  // =========================================================
  public switchFloor(floor: FloorId) {
    this.currentFloor = floor;
    const floorMat = this.mapPlane.material as THREE.MeshBasicMaterial;
    floorMat.map =
      floor === 1 ? this.texFloor1 : floor === 2 ? this.texFloor2 : this.texFloor3;
    floorMat.needsUpdate = true;

    // Hiding the root screen also hides the podium, side monitors and shadow children.
    this.btcVideotron.mesh.visible = floor === 3;

    this.placedFurniture.forEach((f) => {
      const vis = f.floor === this.currentFloor;
      f.mesh.visible = vis;
      if (f.shadowMesh) f.shadowMesh.visible = vis;
    });
    this.placedWalls.forEach((w) => {
      w.mesh.visible = w.floor === this.currentFloor;
    });
    this.roomZones.forEach((z) => {
      if (z.slidingDoorMesh) z.slidingDoorMesh.visible = z.spec.floor === this.currentFloor;
    });

    this.selectedPlacedItem = null;
    this.selectionRing.visible = false;
    this.callbacks.onSelectionHint?.(
      'MODE EDIT: Klik & Drag furnitur/dinding (Snap Grid aktif), R untuk flip, Del untuk bongkar.',
      false
    );
    this.callbacks.onFloorChange?.(floor);
  }

  public getCurrentFloor(): FloorId {
    return this.currentFloor;
  }

  public setSnapToGrid(enabled: boolean) {
    this.snapToGrid = enabled;
    this.editGridGroup.visible = this.editMode && this.snapToGrid;
  }

  public getSnapToGrid(): boolean {
    return this.snapToGrid;
  }

  public clearWallsOnCurrentFloor() {
    for (let i = this.placedWalls.length - 1; i >= 0; i--) {
      if (this.placedWalls[i].floor === this.currentFloor) {
        this.scene.remove(this.placedWalls[i].mesh);
        this.placedWalls.splice(i, 1);
      }
    }
    this.selectedPlacedItem = null;
    this.selectionRing.visible = false;
    this.saveWallsToStorage();
    this.callbacks.onSelectionHint?.(
      `Semua dinding di Lantai ${this.currentFloor} dibongkar (base floor polos).`,
      false
    );
  }

  public setCutawayEnabled(enabled: boolean) {
    this.cutawayEnabled = enabled;
    if (!enabled) {
      this.placedWalls.forEach((w) => {
        if (w.isCutaway) {
          w.isCutaway = false;
          w.mat.map = w.piece.texture;
          w.mat.needsUpdate = true;
        }
      });
    }
  }

  public getCutawayEnabled(): boolean {
    return this.cutawayEnabled;
  }

  public setEditMode(enabled: boolean) {
    this.editMode = enabled;
    this.editGridGroup.visible = enabled && this.snapToGrid;
    if (!enabled) {
      this.selectedCatalogToPlace = null;
      this.selectedPlacedItem = null;
      this.draggingPlacedItem = null;
      this.ghostMesh.visible = false;
      this.selectionRing.visible = false;
      this.controls.enabled = true;
    }
  }

  public selectFurnitureToPlace(item: FurnitureCatalogItem | null) {
    if (!item) {
      this.selectedCatalogToPlace = null;
      this.ghostMesh.visible = false;
      return;
    }
    this.selectedCatalogToPlace = { kind: 'furniture', item };
    this.selectedPlacedItem = null;
    this.selectionRing.visible = false;
    this.ghostMat.map = item.frames[0];
    this.ghostMat.needsUpdate = true;
    this.ghostMesh.geometry.dispose();
    this.ghostMesh.geometry = new THREE.PlaneGeometry(item.width, item.height);
    this.ghostMesh.visible = false;
    this.callbacks.onSelectionHint?.(`Klik lantai untuk meletakkan: ${item.name}`, false);
  }

  public selectWallToPlace(piece: WallPieceCatalog | null) {
    if (!piece) {
      this.selectedCatalogToPlace = null;
      this.ghostMesh.visible = false;
      return;
    }
    this.selectedCatalogToPlace = { kind: 'wall', piece };
    this.selectedPlacedItem = null;
    this.selectionRing.visible = false;
    this.ghostMat.map = piece.texture;
    this.ghostMat.needsUpdate = true;
    this.ghostMesh.geometry.dispose();
    this.ghostMesh.geometry = new THREE.PlaneGeometry(piece.width, piece.height);
    this.ghostMesh.visible = false;
    this.callbacks.onSelectionHint?.(`Klik lantai untuk memasang dinding: ${piece.name}`, false);
  }

  public flipCurrentItem() {
    if (this.selectedCatalogToPlace) {
      this.placementFlipX = !this.placementFlipX;
      this.ghostMesh.scale.x = this.placementFlipX ? -1 : 1;
    } else if (this.selectedPlacedItem) {
      this.selectedPlacedItem.flipX = !this.selectedPlacedItem.flipX;
      this.selectedPlacedItem.mesh.scale.x = this.selectedPlacedItem.flipX ? -1 : 1;
      if (this.selectedPlacedItem.kind === 'furniture') this.saveFurnitureToStorage();
      else this.saveWallsToStorage();
    }
  }

  public deleteSelectedItem() {
    if (!this.selectedPlacedItem) return;
    this.scene.remove(this.selectedPlacedItem.mesh);
    if (this.selectedPlacedItem.kind === 'furniture') {
      if (this.selectedPlacedItem.shadowMesh) this.scene.remove(this.selectedPlacedItem.shadowMesh);
      const idx = this.placedFurniture.indexOf(this.selectedPlacedItem);
      if (idx !== -1) this.placedFurniture.splice(idx, 1);
      this.saveFurnitureToStorage();
    } else {
      const idx = this.placedWalls.indexOf(this.selectedPlacedItem);
      if (idx !== -1) this.placedWalls.splice(idx, 1);
      this.saveWallsToStorage();
    }
    this.selectedPlacedItem = null;
    this.selectionRing.visible = false;
    this.callbacks.onSelectionHint?.('Item terhapus dari lantai.', false);
  }

  public resetDefaultLayout() {
    localStorage.removeItem(STORAGE_FURNITURE_KEY);
    localStorage.removeItem(STORAGE_WALL_KEY);
    this.loadDefaultOrSavedFurniture();
    this.loadDefaultOrSavedWalls();
    this.selectedPlacedItem = null;
    this.selectionRing.visible = false;
    this.callbacks.onSelectionHint?.('Layout furnitur & dinding dikembalikan ke default!', false);
  }

  public exportLayoutJson(): string {
    this.saveFurnitureToStorage();
    this.saveWallsToStorage();
    const payload = {
      furniture: JSON.parse(localStorage.getItem(STORAGE_FURNITURE_KEY) || '[]'),
      walls: JSON.parse(localStorage.getItem(STORAGE_WALL_KEY) || '[]')
    };
    const raw = JSON.stringify(payload, null, 2);
    (window as unknown as Record<string, unknown>).__LAST_COPIED_LAYOUT__ = raw;
    return raw;
  }

  public toggleElevatorDoors(): boolean {
    this.forceOpenDoors = !this.forceOpenDoors;
    return this.forceOpenDoors;
  }

  public resetCamera() {
    this.followAgentId = null;
    this.camera.zoom = 1;
    this.camera.position.set(0, 0, 10);
    this.controls.target.set(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }

  public focusAgent(agentId: string) {
    const agent = this.agents.find((a) => a.config.id === agentId);
    if (!agent) return;
    this.followAgentId = agentId;
    if (this.currentFloor !== agent.floor) {
      this.switchFloor(agent.floor);
    }
  }

  public setFollowAgent(agentId: string | null) {
    this.followAgentId = agentId;
  }

  // =========================================================
  // MUSE ROUTING & CROSS-FLOOR ELEVATOR DISPATCH
  // =========================================================
  public dispatchMuseEvent(payload: MuseEventPayload, autoRelay = true): boolean {
    const query = payload.agentId.toLowerCase();
    const agent = this.agents.find(
      (a) =>
        a.config.id.toLowerCase() === query ||
        a.config.id.toLowerCase().includes(query) ||
        a.config.name.toLowerCase().includes(query) ||
        a.config.code === query
    );
    if (!agent) return false;

    const targetRoom =
      getRoomById(payload.targetRoom) ??
      getRoomById(agent.config.homeRoom) ??
      ROOM_DEFINITIONS.Floor1_BossRoom;

    const mappedAction: AgentActionState =
      payload.action === 'success'
        ? 'celebrating'
        : payload.action === 'typing'
          ? 'typing'
          : payload.action === 'thinking'
            ? 'thinking'
            : payload.action === 'coffee'
              ? 'coffee'
              : 'idle';

    this.sendAgentToRoom(
      agent,
      targetRoom.id,
      mappedAction,
      payload.statusText,
      autoRelay ? payload.nextAgent : undefined
    );

    this.callbacks.onActivityLog?.({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour12: false }),
      agentId: agent.config.id,
      agentName: agent.config.name,
      floor: targetRoom.floor,
      action: payload.action,
      message: payload.statusText,
      payloadJson: JSON.stringify(payload)
    });

    return true;
  }

  public sendAgentToRoom(
    agent: AgentEntity,
    targetRoomId: string,
    action: AgentActionState,
    taskText: string,
    nextAgentId?: string
  ) {
    const destRoom = getRoomById(targetRoomId);
    if (!destRoom) return;

    agent.targetRoomId = destRoom.id;
    agent.pendingAction = action;
    agent.pendingTask = taskText;
    agent.pendingNextAgent = nextAgentId;
    agent.dwellTimer = 0;
    agent.faceUp = !!destRoom.faceUp;
    agent.faceLeft = !!destRoom.faceLeft;

    const curRoom = getRoomById(agent.currentRoomId);
    const curNode =
      agent.waypoints.length === 0 && agent.elevatorStage === 'none' && curRoom && curRoom.floor === agent.floor
        ? curRoom.navNodeId
        : findNearestNavNode(agent.pos, agent.floor);

    if (destRoom.floor === agent.floor) {
      agent.elevatorStage = 'none';
      agent.pendingFloor = undefined;
      agent.pendingRoomId = undefined;
      if (curNode === destRoom.navNodeId && curRoom?.id === destRoom.id) {
        agent.waypoints = [uvToWorld(destRoom.u, destRoom.v)];
      } else {
        agent.waypoints = findPathBetweenNodes(curNode, destRoom.navNodeId, agent.floor);
        agent.waypoints.push(uvToWorld(destRoom.u, destRoom.v));
      }
      agent.action = 'walking';
      agent.task = `Menuju ${destRoom.label}`;
    } else {
      // Floor 2's baked elevator shaft ONLY has a SW (left) door; force left door whenever F2 is involved.
      if (agent.floor === 2 || destRoom.floor === 2) {
        agent.elevatorDoorSide = 'left';
      }
      const lobbyNode = agent.elevatorDoorSide === 'left' ? 'lift_lobby_l' : 'lift_lobby_r';
      agent.elevatorStage = 'to_lobby';
      agent.pendingFloor = destRoom.floor;
      agent.pendingRoomId = destRoom.id;
      agent.waypoints = findPathBetweenNodes(curNode, lobbyNode, agent.floor);
      agent.action = 'walking';
      agent.task = `Ke Central Lift -> Lantai ${destRoom.floor}`;
    }
  }

  public triggerMusePipelineRelay(briefTitle: string) {
    const cleanTopic = briefTitle.trim() || 'Arsitektur AI Kantor-Rama';
    this.followAgentId = 'rama';
    this.switchFloor(1);

    this.dispatchMuseEvent(
      {
        agentId: 'rama',
        action: 'thinking',
        targetRoom: 'Floor1_BossRoom',
        statusText: `Brief diset RAMA: "${cleanTopic}" -> PUTRI`,
        nextAgent: 'putri'
      },
      true
    );
  }

  private getDefaultTaskForAgent(agentId: string): {
    roomId: string;
    action: 'typing' | 'thinking' | 'success';
    text: string;
    nextAgent?: string;
  } {
    switch (agentId) {
      case 'putri':
        return {
          roomId: 'Floor1_Desk2',
          action: 'typing',
          text: 'Menulis 5 Hook & Naskah Per-Scene (Approval Gate Yang Mulia)',
          nextAgent: 'raga'
        };
      case 'raga':
        return {
          roomId: 'Floor2_DesignDesk',
          action: 'typing',
          text: 'Edit Shotcraft & Voicebox Narasi (Remotion khusus Yang Mulia)',
          nextAgent: 'meimei'
        };
      case 'meimei':
        return {
          roomId: 'Floor2_MultiMonitor',
          action: 'thinking',
          text: 'QA Gate Frame & Audio — Lulus, atau perbaiki (video-qa)',
          nextAgent: 'aruna'
        };
      case 'aruna':
        return {
          roomId: 'Floor1_TripleDesk',
          action: 'typing',
          text: 'Susun Paket Publish & SEO -> Siap Terbit (yt-package)',
          nextAgent: 'fizi'
        };
      case 'fizi':
        return {
          roomId: 'Floor1_Lounge',
          action: 'success',
          text: 'Siap Publik! FIZI balas komentar audiens & feedback!'
        };
      default:
        return {
          roomId: 'Floor1_BossRoom',
          action: 'success',
          text: 'Laporan diteruskan ke RAMA!'
        };
    }
  }

  // =========================================================
  // POINTER & KEYBOARD INTERACTION
  // =========================================================
  private getWorldPointOnFloor(e: PointerEvent): THREE.Vector2 | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const hits = this.raycaster.intersectObject(this.mapPlane);
    if (hits.length > 0) {
      return new THREE.Vector2(hits[0].point.x, hits[0].point.y);
    }
    return null;
  }

  private getClickedItem(e: PointerEvent): SelectablePlaced | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);

    const floorMeshes = [
      ...this.placedFurniture.filter((f) => f.floor === this.currentFloor).map((f) => f.mesh),
      ...this.placedWalls.filter((w) => w.floor === this.currentFloor).map((w) => w.mesh)
    ];

    const hits = this.raycaster.intersectObjects(floorMeshes, false);
    if (hits.length > 0) {
      hits.sort((a, b) => b.object.renderOrder - a.object.renderOrder);
      const topMesh = hits[0].object;
      return (
        this.placedFurniture.find((f) => f.mesh === topMesh) ??
        this.placedWalls.find((w) => w.mesh === topMesh) ??
        null
      );
    }
    return null;
  }

  private getClickedAgent(e: PointerEvent): AgentEntity | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);

    const agentMeshes = this.agents
      .filter((a) => a.floor === this.currentFloor && a.elevatorStage !== 'riding' && a.mesh.visible)
      .map((a) => a.mesh);
    const hits = this.raycaster.intersectObjects(agentMeshes, false);
    if (hits.length > 0) {
      hits.sort((a, b) => b.object.renderOrder - a.object.renderOrder);
      return this.agents.find((a) => a.mesh === hits[0].object) ?? null;
    }
    return null;
  }

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    if (!this.editMode) {
      const hitAgent = this.getClickedAgent(e);
      if (hitAgent) {
        this.callbacks.onAgentClick?.(hitAgent.config.id);
      }
      return;
    }
    const rawPt = this.getWorldPointOnFloor(e);
    if (!rawPt) return;

    if (this.selectedCatalogToPlace) {
      const pt = this.snapToGrid
        ? snapWorldToIsoGrid(rawPt, this.selectedCatalogToPlace.kind === 'wall' ? 4 : 8)
        : rawPt;
      if (this.selectedCatalogToPlace.kind === 'furniture') {
        const created = this.spawnFurnitureInstance(
          this.selectedCatalogToPlace.item,
          this.currentFloor,
          pt,
          this.placementFlipX,
          true
        );
        this.selectedPlacedItem = created;
        this.selectionRing.visible = true;
        this.selectionRing.position.set(created.pos.x, created.pos.y, 0.16);
      } else {
        const created = this.spawnWallInstance(
          this.selectedCatalogToPlace.piece,
          this.currentFloor,
          pt,
          this.placementFlipX,
          true
        );
        this.selectedPlacedItem = created;
        this.selectionRing.visible = true;
        this.selectionRing.position.set(created.pos.x, created.pos.y, 0.16);
      }
      return;
    }

    const hit = this.getClickedItem(e);
    if (hit) {
      this.selectedPlacedItem = hit;
      this.draggingPlacedItem = hit;
      this.controls.enabled = false;
      this.selectionRing.visible = true;
      this.selectionRing.position.set(hit.pos.x, hit.pos.y, 0.16);
      const uv = worldToUV(hit.pos.x, hit.pos.y);
      const label = hit.kind === 'furniture' ? hit.catalog.name : hit.piece.name;
      this.callbacks.onSelectionHint?.(
        `Terpilih: ${label} • u=${uv.u.toFixed(3)}, v=${uv.v.toFixed(3)}`,
        true
      );
    } else {
      this.selectedPlacedItem = null;
      this.selectionRing.visible = false;
      this.callbacks.onSelectionHint?.(
        'MODE EDIT: Klik & Drag furnitur/dinding (Snap Grid aktif), R untuk flip, Del untuk bongkar.',
        false
      );
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.editMode) return;
    const rawPt = this.getWorldPointOnFloor(e);
    if (!rawPt) return;

    if (this.selectedCatalogToPlace) {
      const sel = this.selectedCatalogToPlace;
      const isWall = sel.kind === 'wall';
      const pt = this.snapToGrid ? snapWorldToIsoGrid(rawPt, isWall ? 4 : 8) : rawPt;
      const offsetY =
        sel.kind === 'wall'
          ? sel.piece.height * (sel.piece.anchorRatio - 0.5)
          : sel.item.height * 0.48;
      this.ghostMesh.visible = true;
      this.ghostMesh.position.set(pt.x, pt.y + offsetY, 0.35);
      this.ghostMesh.scale.x = this.placementFlipX ? -1 : 1;
    } else if (this.draggingPlacedItem) {
      const item = this.draggingPlacedItem;
      const pt = this.snapToGrid
        ? snapWorldToIsoGrid(rawPt, item.kind === 'wall' ? 4 : 8)
        : rawPt;
      if (item.kind === 'furniture') {
        item.origin.copy(pt);
        item.pos.copy(pt);
        item.target.copy(pt);
        item.mesh.position.set(pt.x, pt.y + item.catalog.height * 0.48, 0.18);
        item.mesh.renderOrder = calcRenderOrder(pt.y, item.catalog.layerBonus ?? 0);
        if (item.shadowMesh) {
          item.shadowMesh.position.set(pt.x, pt.y + 0.02, 0.02);
          item.shadowMesh.renderOrder = calcRenderOrder(pt.y, -4);
        }
      } else {
        item.pos.copy(pt);
        item.mesh.position.set(
          pt.x,
          pt.y + item.piece.height * (item.piece.anchorRatio - 0.5),
          0.16
        );
        item.mesh.renderOrder = calcRenderOrder(pt.y, 0);
      }
      this.selectionRing.position.set(pt.x, pt.y, 0.16);
      const uv = worldToUV(pt.x, pt.y);
      const label = item.kind === 'furniture' ? item.catalog.name : item.piece.name;
      this.callbacks.onSelectionHint?.(
        `Menggeser: ${label} • u=${uv.u.toFixed(3)}, v=${uv.v.toFixed(3)}`,
        true
      );
    }
  };

  private onPointerUp = () => {
    if (this.draggingPlacedItem) {
      const kind = this.draggingPlacedItem.kind;
      this.draggingPlacedItem = null;
      this.controls.enabled = true;
      if (kind === 'furniture') this.saveFurnitureToStorage();
      else this.saveWallsToStorage();
    }
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (
      document.activeElement &&
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)
    ) {
      return;
    }
    if (e.key.toLowerCase() === 'r') {
      this.flipCurrentItem();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this.editMode && this.selectedPlacedItem) this.deleteSelectedItem();
    } else if (e.key === 'Escape') {
      this.selectedCatalogToPlace = null;
      this.selectedPlacedItem = null;
      this.ghostMesh.visible = false;
      this.selectionRing.visible = false;
    }
  };

  private onResize = () => {
    const w = Math.max(1, this.container.clientWidth || window.innerWidth);
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    const aspect = w / h;
    this.camera.left = (-this.viewHeight * aspect) / 2;
    this.camera.right = (this.viewHeight * aspect) / 2;
    this.camera.top = this.viewHeight / 2;
    this.camera.bottom = -this.viewHeight / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private onControlsStart = () => {
    this.followAgentId = null;
  };

  private bindEvents() {
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('resize', this.onResize);
  }

  // =========================================================
  // MAIN 4-PASS ANIMATION LOOP
  // =========================================================
  private animate = (nowMs: number) => {
    if (this.disposed) return;
    this.animationFrameId = requestAnimationFrame(this.animate);

    const delta = Math.min((nowMs - this.lastTimeMs) / 1000, 0.1);
    this.lastTimeMs = nowMs;
    const elapsed = nowMs / 1000;

    const smoothLerp = (rate: number) => 1 - Math.exp(-rate * delta);

    // Smoothly pan camera toward followed agent (released automatically on manual drag)
    if (this.followAgentId && !this.editMode) {
      const followed = this.agents.find((a) => a.config.id === this.followAgentId);
      if (followed && followed.floor === this.currentFloor && followed.elevatorStage !== 'riding') {
        const camAlpha = smoothLerp(5.5);
        const dx = (followed.renderPos.x - this.controls.target.x) * camAlpha;
        const dy = (followed.renderPos.y + 0.45 - this.controls.target.y) * camAlpha;
        this.controls.target.x += dx;
        this.controls.target.y += dy;
        this.camera.position.x += dx;
        this.camera.position.y += dy;
      }
    }

    this.controls.update();
    this.btcVideotron.update(elapsed);

    const floorHasActiveLiftRider: Record<FloorId, boolean> = { 1: false, 2: false, 3: false };
    const occupiedFurnitureUids = new Set<string>();

    // 1. Update Agents (Delta-Time Smooth Pathfinding + Seated Combo Walk-Up + Exponential Lerp)
    this.agents.forEach((agent, i) => {
      let isMoving = false;
      let movingUp = false;
      let movingLeft = agent.faceLeft;

      if (agent.elevatorStage === 'entering') {
        floorHasActiveLiftRider[agent.floor] = true;
        agent.elevatorTimer -= delta;
        const doorInside =
          agent.floor === 2
            ? uvToWorld(0.459, 0.548)
            : uvToWorld(agent.elevatorDoorSide === 'left' ? 0.474 : 0.550, 0.576);
        agent.pos.lerp(doorInside, smoothLerp(6.5));
        isMoving = true;
        movingUp = true;
        if (agent.elevatorTimer <= 0) {
          agent.elevatorStage = 'riding';
          agent.elevatorTimer = 0.55;
        }
      } else if (agent.elevatorStage === 'riding') {
        agent.elevatorTimer -= delta;
        if (agent.elevatorTimer <= 0 && agent.pendingFloor) {
          agent.floor = agent.pendingFloor;
          floorHasActiveLiftRider[agent.floor] = true;
          if (this.followAgentId === agent.config.id && this.currentFloor !== agent.floor) {
            this.switchFloor(agent.floor);
          }
          const doorInside =
            agent.floor === 2
              ? uvToWorld(0.459, 0.548)
              : uvToWorld(agent.elevatorDoorSide === 'left' ? 0.474 : 0.550, 0.576);
          agent.pos.copy(doorInside);
          agent.renderPos.copy(doorInside);
          agent.elevatorStage = 'exiting';
          agent.elevatorTimer = 0.45;
          agent.task = `Tiba di Lantai ${agent.floor}`;
        }
      } else if (agent.elevatorStage === 'exiting') {
        floorHasActiveLiftRider[agent.floor] = true;
        agent.elevatorTimer -= delta;
        const lobbyNodeId = agent.elevatorDoorSide === 'left' ? 'lift_lobby_l' : 'lift_lobby_r';
        const lobbyNode = FLOOR_NAV_NODES[lobbyNodeId];
        const lobbyPos = uvToWorld(lobbyNode.u, lobbyNode.v);
        agent.pos.lerp(lobbyPos, smoothLerp(7.0));
        isMoving = true;
        movingUp = false;
        if (agent.elevatorTimer <= 0) {
          agent.elevatorStage = 'none';
          const destRoom = getRoomById(agent.pendingRoomId || agent.targetRoomId);
          if (destRoom) {
            agent.waypoints = findPathBetweenNodes(lobbyNodeId, destRoom.navNodeId, agent.floor);
            agent.waypoints.push(uvToWorld(destRoom.u, destRoom.v));
            if (agent.waypoints.length > 1 && agent.pos.distanceTo(agent.waypoints[0]) < 0.10) {
              agent.waypoints.shift();
            }
            agent.action = 'walking';
            agent.task = `Menuju ${destRoom.label}`;
          }
        }
      } else if (agent.waypoints.length > 0) {
        const speed = 1.08;
        let remaining = speed * delta;
        while (agent.waypoints.length > 0 && remaining > 0) {
          const nextPt = agent.waypoints[0];
          const dir = new THREE.Vector2().subVectors(nextPt, agent.pos);
          const dist = dir.length();

          if (dist <= remaining || dist < 0.03) {
            agent.pos.copy(nextPt);
            agent.waypoints.shift();
            remaining = Math.max(0, remaining - dist);

            if (agent.waypoints.length === 0) {
              if (agent.elevatorStage === 'to_lobby') {
                agent.elevatorStage = 'entering';
                agent.elevatorTimer = 0.45;
                agent.action = 'elevator_wait';
                agent.task = `Masuk Central Lift -> Lantai ${agent.pendingFloor}`;
                floorHasActiveLiftRider[agent.floor] = true;
              } else {
                agent.currentRoomId = agent.targetRoomId;
                const step = agent.config.schedule[agent.scheduleIdx];
                agent.action = agent.pendingAction ?? step?.action ?? 'idle';
                agent.task = agent.pendingTask ?? step?.task ?? 'Active';
                agent.dwellDuration = step?.dwell ?? 4.2;
                agent.dwellTimer = agent.dwellDuration;
                agent.pendingAction = undefined;
                agent.pendingTask = undefined;

                const nextAgent = agent.pendingNextAgent;
                agent.pendingNextAgent = undefined;
                if (nextAgent) agent.queuedNextAgent = nextAgent;
              }
              break;
            }
          } else {
            isMoving = true;
            dir.divideScalar(dist);
            agent.pos.addScaledVector(dir, remaining);
            agent.walkPhase += delta * 6.8;
            movingUp = dir.y > 0.10;
            if (Math.abs(dir.x) > 0.06) movingLeft = dir.x < 0;
            agent.faceUp = movingUp;
            agent.faceLeft = movingLeft;
            remaining = 0;
          }
        }
      } else if (agent.dwellTimer > 0) {
        agent.dwellTimer -= delta;
        movingUp = agent.faceUp;
        movingLeft = agent.faceLeft;

        if (agent.queuedNextAgent && agent.dwellTimer < agent.dwellDuration * 0.35) {
          const nextId = agent.queuedNextAgent;
          agent.queuedNextAgent = undefined;
          const nextTask = this.getDefaultTaskForAgent(nextId);
          if (this.followAgentId === agent.config.id) this.followAgentId = nextId;
          this.dispatchMuseEvent(
            {
              agentId: nextId,
              action: nextTask.action,
              targetRoom: nextTask.roomId,
              statusText: nextTask.text,
              nextAgent: nextTask.nextAgent
            },
            true
          );
        }

        if (agent.dwellTimer <= 0) {
          agent.scheduleIdx = (agent.scheduleIdx + 1) % agent.config.schedule.length;
          const nextStep = agent.config.schedule[agent.scheduleIdx];
          this.sendAgentToRoom(agent, nextStep.roomId, nextStep.action, nextStep.task);
        }
      }

      const onFloor = agent.floor === this.currentFloor && agent.elevatorStage !== 'riding';
      agent.mesh.visible = onFloor;
      agent.usingCombo = false;

      // Resolve Seated Furniture Combo Swap ONLY when matched to a real unoccupied furniture piece
      let usedCombo = false;
      const targetVisualPos = agent.pos.clone();
      if (
        !isMoving &&
        !this.editMode &&
        agent.elevatorStage === 'none' &&
        (agent.action === 'typing' || agent.action === 'thinking' || agent.action === 'coffee')
      ) {
        const match = resolveAgentFurnitureCombo(
          agent.config.id,
          agent.action,
          agent.pos,
          agent.floor,
          this.placedFurniture,
          occupiedFurnitureUids
        );
        const combo = match ? this.comboAnimations.get(match.comboKey) : undefined;
        if (match && combo && combo.frames.length > 0) {
          const seatDist = agent.pos.distanceTo(match.anchorPos);
          if (seatDist > 0.14) {
            // Walk smoothly up to the seat before swapping into the seated combo sprite
            const walkDir = new THREE.Vector2().subVectors(match.anchorPos, agent.pos).normalize();
            agent.pos.addScaledVector(walkDir, Math.min(seatDist, 1.15 * delta));
            agent.walkPhase += delta * 6.8;
            isMoving = true;
            movingUp = walkDir.y > 0.10;
            if (Math.abs(walkDir.x) > 0.06) movingLeft = walkDir.x < 0;
            agent.faceUp = movingUp;
            agent.faceLeft = movingLeft;
            targetVisualPos.copy(agent.pos);
          } else {
            agent.pos.lerp(match.anchorPos, smoothLerp(14));
            targetVisualPos.copy(match.anchorPos);
            occupiedFurnitureUids.add(match.furnitureUid);
            const cIdx = Math.floor(elapsed * combo.fps + i) % combo.frames.length;
            agent.renderPos.lerp(targetVisualPos, smoothLerp(18));
            agent.mesh.rotation.z = 0;
            this.applyAgentFrame(agent, combo.frames[cIdx], false, 0, agent.renderPos);
            agent.usingCombo = true;
            usedCombo = true;
          }
        }
      }

      if (!usedCombo) {
        agent.renderPos.lerp(targetVisualPos, smoothLerp(18));
      }

      agent.shadowMesh.visible = onFloor;
      let activeBob = 0;

      if (!usedCombo) {
        let activeFrames = agent.framesFront;
        if (isMoving) {
          activeFrames = movingUp && agent.framesBack.length > 0 ? agent.framesBack : agent.framesFront;
        } else if (agent.action === 'celebrating' && agent.framesCelebrate.length > 0) {
          activeFrames = agent.framesCelebrate;
        } else if (agent.action === 'coffee' && agent.framesCoffee.length > 0) {
          activeFrames = agent.framesCoffee;
        } else if (agent.action === 'typing' && agent.framesTyping.length > 0) {
          activeFrames = agent.framesTyping;
        } else if (movingUp && agent.framesBack.length > 0) {
          activeFrames = agent.framesBack;
        }

        if (activeFrames.length > 0) {
          const frameIdx = isMoving
            ? Math.floor(agent.walkPhase) % activeFrames.length
            : Math.floor(elapsed * 1.8 + i) % activeFrames.length;
          const frame = activeFrames[frameIdx];
          activeBob = isMoving
            ? Math.abs(Math.sin(agent.walkPhase * Math.PI)) * 0.024
            : agent.action === 'celebrating'
              ? Math.abs(Math.sin(elapsed * 7.0 + i)) * 0.028
              : Math.sin(elapsed * 3.0 + i) * 0.006;
          agent.mesh.rotation.z = isMoving ? Math.sin(agent.walkPhase * Math.PI) * 0.030 : 0;
          this.applyAgentFrame(agent, frame, movingLeft, activeBob, agent.renderPos);
        }
      }

      agent.mesh.renderOrder = calcRenderOrder(agent.renderPos.y, 2);
      if (usedCombo) {
        agent.shadowMesh.scale.set(2.35, 1.95, 1);
      } else {
        const s = Math.max(0.76, 1 - activeBob * 4.5);
        agent.shadowMesh.scale.set(s, s, 1);
      }
      agent.shadowMesh.position.set(agent.renderPos.x, agent.renderPos.y + 0.015, 0.02);
      agent.shadowMesh.renderOrder = calcRenderOrder(agent.renderPos.y, -4);
    });

    // 2. Room Occupancy & Animated Sliding Glass Doors (100% open visibility — zero fog occlusion)
    const visibleAgentsOnFloor = this.agents.filter(
      (a) => a.floor === this.currentFloor && a.elevatorStage !== 'riding'
    );

    const floorZones = this.roomZones.filter((z) => z.spec.floor === this.currentFloor);

    floorZones.forEach((zone) => {
      const occupants: string[] = [];
      visibleAgentsOnFloor.forEach((a) => {
        const uv = worldToUV(a.pos.x, a.pos.y);
        if (pointInPolygonUV(uv.u, uv.v, zone.spec.polygonUV)) {
          occupants.push(a.config.name);
        }
      });

      let doorOpen = this.forceOpenDoors;
      if (!doorOpen) {
        for (const sensor of zone.doorWorldSensors) {
          for (const a of visibleAgentsOnFloor) {
            if (a.pos.distanceTo(sensor) < 1.15) {
              doorOpen = true;
              break;
            }
          }
          if (doorOpen) break;
        }
      }

      // Animate Sliding Glass Door frame (0 = closed -> 3 = cyan lit open) strictly on THAT doorway's proximity
      if (zone.slidingDoorMesh && zone.slidingDoorMat && zone.slidingDoorWorldPos) {
        zone.slidingDoorMesh.visible = true;
        let thisDoorTriggered = this.forceOpenDoors;
        if (!thisDoorTriggered) {
          for (const a of visibleAgentsOnFloor) {
            if (a.renderPos.distanceTo(zone.slidingDoorWorldPos) < 0.72) {
              thisDoorTriggered = true;
              break;
            }
          }
        }
        const targetDoorFrame = thisDoorTriggered ? 3 : 0;
        zone.slidingDoorFrame = THREE.MathUtils.lerp(
          zone.slidingDoorFrame,
          targetDoorFrame,
          smoothLerp(9)
        );
        const fIdx = Math.min(3, Math.max(0, Math.round(zone.slidingDoorFrame)));
        if (this.slidingDoorFrames.length === 4 && zone.slidingDoorMat.map !== this.slidingDoorFrames[fIdx]) {
          zone.slidingDoorMat.map = this.slidingDoorFrames[fIdx];
          zone.slidingDoorMat.needsUpdate = true;
        }
      }

      zone.doorOpen = doorOpen;
      zone.occupants = occupants;
    });

    this.btcVideotron.mesh.visible = this.currentFloor === 3;

    // 3. Dynamic Wall Cutaway (Full Wall <-> Cutaway Half-Wall when agent <= ~2 tiles behind)
    this.placedWalls.forEach((w) => {
      if (w.floor !== this.currentFloor) {
        w.mesh.visible = false;
        return;
      }
      w.mesh.visible = true;

      let shouldCut = false;
      if (this.cutawayEnabled) {
        for (const a of visibleAgentsOnFloor) {
          const dy = a.pos.y - w.pos.y;
          const dx = Math.abs(a.pos.x - w.pos.x);
          if (dy > 0.02 && dy < 1.50 && dx < 1.15) {
            shouldCut = true;
            break;
          }
        }
      }

      if (shouldCut !== w.isCutaway) {
        w.isCutaway = shouldCut;
        w.mat.map = shouldCut ? w.piece.cutawayTexture : w.piece.texture;
        w.mat.needsUpdate = true;
      }
    });

    // 4. Update Central Elevator Doors (Floor_1_pure & Floor_2_pure already bake crisp closed silver doors;
    //    only overlay animated open cyan frames idx > 0 when an agent approaches or doors are forced open)
    this.doors.forEach((d) => {
      if (d.floor !== this.currentFloor) {
        d.mesh.visible = false;
        return;
      }

      let near = this.forceOpenDoors || floorHasActiveLiftRider[d.floor];
      if (!near) {
        for (const a of this.agents) {
          if (a.floor === d.floor && a.pos.distanceTo(d.pos) < 1.05) {
            near = true;
            break;
          }
        }
      }

      const targetFrame = near ? 3 : 0;
      d.currentFrame = THREE.MathUtils.lerp(d.currentFrame, targetFrame, smoothLerp(9));
      const idx = Math.min(3, Math.max(0, Math.round(d.currentFrame)));
      d.mesh.visible = idx > 0;
      if (this.elevatorFrames.length === 4 && d.mat.map !== this.elevatorFrames[idx]) {
        d.mat.map = this.elevatorFrames[idx];
        d.mat.needsUpdate = true;
      }
    });

    // 5. Update Furniture & Pets
    this.placedFurniture.forEach((f, idx) => {
      if (f.floor !== this.currentFloor) {
        f.mesh.visible = false;
        if (f.shadowMesh) f.shadowMesh.visible = false;
        return;
      }

      // Single-render guard: hide static desk/chair/sofa while an active seated combo sprite owns this piece
      const hiddenByCombo = !this.editMode && occupiedFurnitureUids.has(f.uid);

      f.mesh.visible = !hiddenByCombo;
      if (f.shadowMesh) f.shadowMesh.visible = f.mesh.visible;
      if (!f.mesh.visible) return;

      if (f.catalog.isPet && this.draggingPlacedItem !== f) {
        const dir = new THREE.Vector2().subVectors(f.target, f.pos);
        const dist = dir.length();
        const isPetMoving = dist >= 0.04;
        if (!isPetMoving) {
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * 0.55;
          f.target.set(
            f.origin.x + Math.cos(angle) * radius,
            f.origin.y + Math.sin(angle) * radius * 0.5
          );
        } else {
          dir.divideScalar(dist);
          f.pos.addScaledVector(dir, Math.min(dist, f.catalog.speed * delta));
          if (Math.abs(dir.x) > 0.04) f.mesh.scale.x = dir.x < 0 ? -1 : 1;
        }

        if (f.catalog.frames.length > 1) {
          const fIdx = Math.floor(elapsed * f.catalog.fps + idx) % f.catalog.frames.length;
          if (f.mat.map !== f.catalog.frames[fIdx]) {
            f.mat.map = f.catalog.frames[fIdx];
            f.mat.needsUpdate = true;
          }
        }

        const hover =
          f.catalog.id === 'pet_drone'
            ? Math.sin(elapsed * 4.5 + idx) * 0.05
            : isPetMoving
              ? Math.abs(Math.sin(elapsed * 8.0 + idx)) * 0.016
              : 0;
        f.mesh.position.set(f.pos.x, f.pos.y + f.catalog.height * 0.48 + hover, 0.20);
        f.mesh.renderOrder = calcRenderOrder(f.pos.y, 1);
        if (f.shadowMesh) {
          const ps = Math.max(0.75, 1 - Math.abs(hover) * 3.0);
          f.shadowMesh.scale.set(ps, ps, 1);
          f.shadowMesh.position.set(f.pos.x, f.pos.y + 0.015, 0.02);
          f.shadowMesh.renderOrder = calcRenderOrder(f.pos.y, -4);
        }
      } else if (!f.catalog.isPet && f.catalog.frames.length > 1 && f.catalog.fps > 0) {
        const fIdx = Math.floor(elapsed * f.catalog.fps + idx) % f.catalog.frames.length;
        if (f.mat.map !== f.catalog.frames[fIdx]) {
          f.mat.map = f.catalog.frames[fIdx];
          f.mat.needsUpdate = true;
        }
      }
    });

    this.renderer.render(this.scene, this.camera);

    if (nowMs - this.lastUiSyncMs >= 32) {
      this.lastUiSyncMs = nowMs;
      this.emitUiSnapshots(floorZones);
    }
  };

  public refreshExnessStatus() {
    void this.exnessFeed.refreshStatus();
  }

  public setExnessAccountSnapshot(profile: 'demo' | 'real', balance: number | null, currency: string | null) {
    this.exnessFeed.setRetrievedAccount(profile, balance, currency);
  }

  public ingestBtcPrice(price: number) {
    if (Number.isFinite(price) && price > 0) {
      this.btcVideotron.ingestTick(price);
    }
  }

  private emitUiSnapshots(floorZones: RoomDoorZoneRuntime[]) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const snapshots: AgentRuntimeSnapshot[] = this.agents.map((a) => {
      const topY = a.renderPos.y + (a.usingCombo ? 1.04 : 0.90);
      const worldPos = new THREE.Vector3(a.renderPos.x, topY, 0.4);
      worldPos.project(this.camera);
      const sx = (worldPos.x * 0.5 + 0.5) * rect.width;
      const sy = (-worldPos.y * 0.5 + 0.5) * rect.height;

      const pct =
        a.dwellDuration > 0 && a.dwellTimer > 0
          ? Math.min(100, Math.max(12, ((a.dwellDuration - a.dwellTimer) / a.dwellDuration) * 100))
          : 62;

      return {
        id: a.config.id,
        agentNumber: a.config.agentNumber,
        code: a.config.code,
        emoji: a.config.emoji,
        name: a.config.name,
        title: a.config.title,
        role: a.config.role,
        department: a.config.department,
        modes: a.config.modes,
        reportsTo: a.config.reportsTo,
        inGroupChat: a.config.inGroupChat,
        skills: a.config.skills,
        colorHex: '#' + a.config.color.toString(16).padStart(6, '0'),
        floor: a.floor,
        currentRoom: a.currentRoomId,
        action: a.action,
        task: a.task,
        progressPct: Math.round(pct),
        screenX: sx,
        screenY: sy,
        visibleOnScreen: a.floor === this.currentFloor && a.elevatorStage !== 'riding',
        isElevatorRiding: a.elevatorStage !== 'none'
      };
    });

    const zoneSnapshots: RoomZoneRuntimeStatus[] = floorZones.map((z) => ({
      zoneId: z.spec.zoneId,
      label: z.spec.label,
      floor: z.spec.floor,
      revealed: true,
      doorOpen: z.doorOpen,
      occupants: z.occupants
    }));

    this.callbacks.onAgentsUpdate?.(snapshots);
    this.callbacks.onRoomZonesUpdate?.(zoneSnapshots);
    this.callbacks.onMarketsUpdate?.({
      btcPrice: this.btcVideotron.lastPrice,
      btcChangePct: this.btcVideotron.priceChangePct,
      btcUp: this.btcVideotron.isBullish(),
      btcIsLive: this.btcVideotron.isLiveWS || this.btcVideotron.hasChart,
      btcSource: this.btcVideotron.feedLabel,
      btcCandles: this.btcVideotron.candles.length,
      btcVideotronVisible: this.currentFloor === 3 && this.btcVideotron.mesh.visible,
      exnessDemoConfigured: this.exnessFeed.demoConfigured,
      exnessRealConfigured: this.exnessFeed.realConfigured,
      demoBalance: this.exnessFeed.demoBalance,
      demoCurrency: this.exnessFeed.demoCurrency,
      realBalance: this.exnessFeed.realBalance,
      realCurrency: this.exnessFeed.realCurrency
    });
  }

  private exposeGlobals() {
    Object.assign(window as unknown as Record<string, unknown>, {
      __KRA_ENGINE__: this,
      placedFurniture: this.placedFurniture,
      placedWalls: this.placedWalls,
      roomZones: this.roomZones,
      btcVideotron: this.btcVideotron,
      AGENTS: this.agents,
      FURNITURE_CATALOG: this.furnitureCatalog,
      WALL_CATALOG: this.wallCatalog,
      WALL_BBOXES,
      doors: this.doors,
      mapPlane: this.mapPlane,
      switchFloor: (f: FloorId) => this.switchFloor(f),
      getCurrentFloor: () => this.currentFloor
    });
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.animationFrameId);

    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.controls.removeEventListener('start', this.onControlsStart);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('resize', this.onResize);

    this.contactShadowTex.dispose();
    this.btcVideotron.dispose();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
