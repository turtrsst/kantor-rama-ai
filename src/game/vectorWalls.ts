import * as THREE from 'three';
import { ISO_DEPTH_K, ISO_WORLD_SLOPE, uvToWorld } from '../data/floorNavGraph';
import { PRECISE_TILE_SEGMENTS } from '../data/wallsCatalog';

/**
 * Vector wall geometry is generated from the SAME registered UV paths as the
 * sliced floorplates. Every vertex gets an isometric depth value derived from
 * its world-Y coordinate, so opaque walls write real depth and every agent /
 * furniture sprite behind them is clipped by the GPU depth test instead of
 * visually penetrating the wall.
 */

export type VectorWallKind = 'solid' | 'wood' | 'glass' | 'portal';

export interface VectorWallVisual {
  kind: VectorWallKind;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshBasicMaterial;
  overlayGeometry?: THREE.BufferGeometry;
  overlayMaterial?: THREE.MeshBasicMaterial;
}

const SOLID_BOTTOM = new THREE.Color(0x1b2430);
const SOLID_TOP = new THREE.Color(0x33465a);
const WOOD_BOTTOM = new THREE.Color(0x593318);
const WOOD_TOP = new THREE.Color(0x8b5a32);
const FRAME_COLOR = new THREE.Color(0x3d4f63);
const PORTAL_FRAME = new THREE.Color(0x4a5c70);
const GLASS_COLOR = new THREE.Color(0x7fb6d9);

const GLASS_IDS = new Set(['wall_02', 'wall_07', 'wall_08', 'wall_09', 'wall_10']);
const PORTAL_IDS = new Set(['wall_18', 'wall_19', 'wall_12', 'wall_13', 'wall_17']);
const WOOD_IDS = new Set(['wall_03', 'wall_04']);

export function classifyVectorWall(pieceId: string, isPerimeter = false): VectorWallKind {
  if (PORTAL_IDS.has(pieceId)) return 'portal';
  // Only the registered outer perimeter keeps see-through glass modules;
  // interior dividers are solid vector walls like the reference cutaways.
  if (isPerimeter && GLASS_IDS.has(pieceId)) return 'glass';
  if (WOOD_IDS.has(pieceId)) return 'wood';
  return 'solid';
}

/** Unit direction of a registered wall segment in world space. */
export function wallDirection(segmentId: string | undefined, flipX: boolean): THREE.Vector2 {
  const seg = segmentId ? PRECISE_TILE_SEGMENTS[segmentId] : undefined;
  if (seg) {
    const a = uvToWorld(seg.a[0], seg.a[1]);
    const b = uvToWorld(seg.b[0], seg.b[1]);
    const d = b.sub(a);
    if (d.lengthSq() > 1e-8) return d.normalize();
  }
  const slope = flipX ? -ISO_WORLD_SLOPE : ISO_WORLD_SLOPE;
  return new THREE.Vector2(1, slope).normalize();
}

interface QuadBuffers {
  positions: number[];
  colors: number[];
  indices: number[];
}

function pushQuad(
  buf: QuadBuffers,
  corners: Array<[number, number]>,
  dir: THREE.Vector2,
  bottom: THREE.Color,
  top: THREE.Color,
  height: number
): void {
  const start = buf.positions.length / 3;
  for (const [s, h] of corners) {
    const dx = dir.x * s;
    const dy = dir.y * s + h;
    // Linear depth: absolute z = isoDepthZ(centerY + dy), so local z = -k*dy.
    buf.positions.push(dx, dy, -ISO_DEPTH_K * dy);
    const t = Math.max(0, Math.min(1, h / height));
    const c = bottom.clone().lerp(top, t);
    buf.colors.push(c.r, c.g, c.b);
  }
  buf.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
}

function makeGeometry(buf: QuadBuffers): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(buf.positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(buf.colors, 3));
  geo.setIndex(buf.indices);
  geo.computeBoundingSphere();
  return geo;
}

function newBuffers(): QuadBuffers {
  return { positions: [], colors: [], indices: [] };
}

export function buildVectorWallVisual(
  pieceId: string,
  width: number,
  height: number,
  dir: THREE.Vector2,
  isPerimeter = false
): VectorWallVisual {
  const kind = classifyVectorWall(pieceId, isPerimeter);
  const body = newBuffers();
  const half = width / 2;
  const bottomColor = kind === 'wood' ? WOOD_BOTTOM : SOLID_BOTTOM;
  const topColor = kind === 'wood' ? WOOD_TOP : SOLID_TOP;
  const frameColor = kind === 'portal' ? PORTAL_FRAME : FRAME_COLOR;

  if (kind === 'solid') {
    pushQuad(body, [[-half, 0], [half, 0], [half, height], [-half, height]], dir, bottomColor, topColor, height);
  } else {
    const rw = Math.min(0.11, width * 0.12);
    const rh = Math.min(0.11, height * 0.12);
    // Left / right posts.
    pushQuad(body, [[-half, 0], [-half + rw, 0], [-half + rw, height], [-half, height]], dir, frameColor, frameColor, height);
    pushQuad(body, [[half - rw, 0], [half, 0], [half, height], [half - rw, height]], dir, frameColor, frameColor, height);
    // Top lintel.
    pushQuad(body, [[-half + rw, height - rh], [half - rw, height - rh], [half - rw, height], [-half + rw, height]], dir, frameColor, frameColor, height);
    if (kind === 'glass') {
      // Bottom rail + translucent glass fill (the opening is see-through).
      pushQuad(body, [[-half + rw, 0], [half - rw, 0], [half - rw, rh], [-half + rw, rh]], dir, frameColor, frameColor, height);
    }
  }

  const geometry = makeGeometry(body);
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    depthWrite: true,
    depthTest: true
  });

  let overlayGeometry: THREE.BufferGeometry | undefined;
  let overlayMaterial: THREE.MeshBasicMaterial | undefined;
  if (kind === 'glass') {
    const rw = Math.min(0.11, width * 0.12);
    const rh = Math.min(0.11, height * 0.12);
    const fill = newBuffers();
    pushQuad(
      fill,
      [[-half + rw, rh], [half - rw, rh], [half - rw, height - rh], [-half + rw, height - rh]],
      dir,
      GLASS_COLOR,
      GLASS_COLOR,
      height
    );
    overlayGeometry = makeGeometry(fill);
    overlayMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
      transparent: true,
      opacity: 0.30,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: true
    });
  }

  return { kind, geometry, material, overlayGeometry, overlayMaterial };
}

/**
 * Gives a billboard plane the same per-vertex isometric depth slope as a
 * vector wall. `yScale` is the runtime mesh scale.y for planes whose geometry
 * is a unit square (agents) rather than already world-sized (furniture).
 */
export function applyIsoDepthToPlane(geometry: THREE.BufferGeometry, yScale = 1): void {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setZ(i, -ISO_DEPTH_K * pos.getY(i) * yScale);
  }
  pos.needsUpdate = true;
  geometry.computeBoundingSphere();
}
