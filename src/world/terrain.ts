// 地形: 地面の高さ（勾配・高架・橋梁・トンネルに合わせる）、地面メッシュ、盛土、トンネル上の山
// 地面は線路方向にのみ変化（横方向は一定）。線路より高くならないので切通しは生じない
import * as THREE from 'three';
import type { GameContext } from '../core/context';
import type { Route } from '../route/types';
import type { Track } from '../route/track';

export type StructureKind = 'tunnel' | 'viaduct' | 'bridge';
type Structure = NonNullable<Route['structures']>[number];

export interface Terrain {
  /** 線路方向位置 s における地面の標高 */
  groundY(s: number): number;
  /** 山（トンネル上）を含む地表の標高 */
  terrainY(s: number, lat: number): number;
  trackY(s: number): number;
  /** s を含む構造物（margin だけ拡張して判定） */
  structureAt(s: number, margin?: number): Structure | undefined;
  /** 川（橋の下）の水面標高。範囲外は null */
  riverAt(s: number): number | null;
  isCity(s: number): boolean;
  /** 踏切の道路にかかるか */
  nearCrossing(s: number, margin?: number): boolean;
  /** ホーム付近か */
  nearStation(s: number, margin?: number): boolean;
  /** 曲率 [1/m]（右カーブ正） */
  curvature(s: number): number;
}

export const TUNNEL_HALF = 5, TUNNEL_CENTER = 2, TUNNEL_WALL_H = 3.2;
const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

const cache = new WeakMap<GameContext, Terrain>();

export function getTerrain(ctx: GameContext): Terrain {
  let t = cache.get(ctx);
  if (!t) { t = makeTerrain(ctx.route, ctx.track); cache.set(ctx, t); }
  return t;
}

function makeTerrain(route: Route, track: Track): Terrain {
  const structs = route.structures ?? [];
  const tunnels = structs.filter(s => s.kind === 'tunnel'), bridges = structs.filter(s => s.kind === 'bridge');
  const trackY = (s: number) => track.trackAt(s).y;
  const tunnelW = (s: number) => {
    let w = 0;
    for (const t of tunnels) {
      const d = Math.max(t.from - 150 - s, s - (t.to + 150), 0);
      w = Math.max(w, smooth(1 - d / 350));
    }
    return w;
  };
  const riverDip = (s: number) => {
    let d = 0;
    for (const b of bridges) {
      const c = (b.from + b.to) / 2, half = (b.to - b.from) / 2;
      d = Math.max(d, 6 * smooth((half * .85 - Math.abs(s - c)) / (half * .4)));
    }
    return d;
  };
  const groundY = (s: number) => {
    const y = trackY(s);
    return (y >= 0 ? y * tunnelW(s) : y) - riverDip(s);
  };
  const hill = (s: number, lat: number) => {
    for (const t of tunnels) {
      if (s < t.from || s > t.to) continue;
      const A = 12 + 26 * smooth(Math.min(s - t.from, t.to - s) / 140);
      const x = Math.abs(lat - TUNNEL_CENTER);
      return A * (x < 14 ? 1 : x > 150 ? 0 : .5 + .5 * Math.cos((x - 14) / 136 * Math.PI));
    }
    return 0;
  };
  const crossings = route.crossings ?? [];
  return {
    groundY, trackY,
    terrainY: (s, lat) => groundY(s) + hill(s, lat),
    structureAt: (s, m = 0) => structs.find(t => s >= t.from - m && s <= t.to + m),
    riverAt: (s) => {
      for (const b of bridges) {
        const c = (b.from + b.to) / 2, half = (b.to - b.from) / 2;
        if (Math.abs(s - c) < half * .7) return -3.6;
      }
      return null;
    },
    isCity: (s) => route.scenery.cityZones.some(z => s > z.from && s < z.to),
    nearCrossing: (s, m = 4) => crossings.some(c => Math.abs(s - c.s) < (c.roadWidth ?? 6) / 2 + m),
    nearStation: (s, m = 0) => route.stations.some(st => s > st.platform.from - m && s < st.platform.to + m),
    curvature: (s) => {
      const a = track.trackAt(s - 2).phi, b = track.trackAt(s + 2).phi;
      return (b - a) / 4;
    },
  };
}

/**
 * 線路に沿った格子メッシュ。cols(s) は [横位置, 絶対標高] の列（行ごとに同数）
 * color(s, j) で頂点色を与える
 */
export function gridAlong(track: Track, s0: number, s1: number, step: number, cols: (s: number) => [number, number][],
  mat: THREE.Material, color?: (s: number, j: number, out: THREE.Color) => void): THREE.Mesh {
  const n = Math.max(2, Math.ceil((s1 - s0) / step) + 1);
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  let m = 0;
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const s = Math.min(s0 + i * step, s1), t = track.trackAt(s), row = cols(s);
    m = row.length;
    row.forEach(([l, y], j) => {
      pos.push(t.x + t.rx * l, y, t.z + t.rz * l);
      if (color) { color(s, j, c); col.push(c.r, c.g, c.b); }
    });
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < m - 1; j++) {
    const a = i * m + j, b = a + 1, cc = a + m, d = cc + 1; idx.push(a, cc, b, b, cc, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (color) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  // 線路の進行方向に対して表裏が逆になる場合があるので法線を上向きへそろえる
  const nr = g.attributes.normal as THREE.BufferAttribute;
  let up = 0; for (let i = 0; i < nr.count; i++) up += nr.getY(i);
  if (up < 0) { g.setIndex(idx.map((_, k) => idx[k - (k % 3) + [0, 2, 1][k % 3]])); g.computeVertexNormals(); }
  return new THREE.Mesh(g, mat);
}

// 0..1 の簡易ハッシュ
export const hash = (x: number, y = 0) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };

/** 地面・盛土・山を生成 */
export function buildTerrain(ctx: GameContext): Terrain {
  const T = getTerrain(ctx), { track, route, scene } = ctx;
  const S0 = route.extent.from - 400, S1 = route.extent.to + 400;
  const groundMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  groundMat.name = 'ground';
  // 地面リボン（曲線内側は折り返さないよう幅を制限）
  const LAT = [-1400, -500, -220, -90, -30, -6, 0, 4, 10, 34, 94, 224, 504, 1404];
  const cols = (s: number): [number, number][] => {
    const y = T.groundY(s), k = T.curvature(s), R = Math.abs(k) > 1e-5 ? 1 / Math.abs(k) : 1e9;
    return LAT.map((l, j) => {
      const inside = (k > 0 && l > 0) || (k < 0 && l < 0);
      const ll = inside ? Math.sign(l) * Math.min(Math.abs(l), R * .85) : l;
      return [ll, j === 0 || j === LAT.length - 1 ? Math.min(y, 0) - 9 : y - .02];
    });
  };
  const gc = new THREE.Color(0x7fa05a), dirt = new THREE.Color(0x9a9270);
  for (let s = S0; s < S1; s += 1000) {
    const g = gridAlong(track, s, Math.min(S1, s + 1000), 10, cols, groundMat, (q, j, out) => {
      const h = hash(Math.floor(q / 30), j);
      out.copy(gc).multiplyScalar(.85 + h * .22);
      if (j >= 5 && j <= 8) out.lerp(dirt, .35); // 線路際は土っぽく
    });
    g.name = 'ground'; scene.add(g);
  }
  // 遠方の地面
  const base = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), new THREE.MeshLambertMaterial({ color: 0x7a9a58 }));
  const mid = track.at((S0 + S1) / 2, 0, 0);
  base.rotation.x = -Math.PI / 2; base.position.set(mid.x, -9, mid.z); base.name = 'ground-far'; scene.add(base);

  // 盛土（線路が地面より高く、構造物でない区間）
  const embMat = new THREE.MeshLambertMaterial({ color: 0x748f4e, side: THREE.DoubleSide });
  const L0 = Math.min(...route.tracks) - 2.5, L1 = Math.max(...route.tracks) + 2.5;
  let runStart: number | null = null;
  const flush = (a: number, b: number) => {
    if (b - a < 4) return;
    scene.add(gridAlong(track, a, b, 5, (s) => {
      const y = T.trackY(s), g = T.groundY(s), dh = Math.max(0, y - g);
      return [[L0 - 1.6 * dh - .5, g - .05], [L0, y - .02], [L1, y - .02], [L1 + 1.6 * dh + .5, g - .05]];
    }, embMat));
  };
  for (let s = S0; s <= S1; s += 5) {
    const need = T.trackY(s) - T.groundY(s) > .08 && !T.structureAt(s, -2);
    if (need && runStart == null) runStart = s - 5;
    if (!need && runStart != null) { flush(runStart, s); runStart = null; }
  }
  if (runStart != null) flush(runStart, S1);

  // トンネル上の山
  const hillMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const forest = new THREE.Color(0x4f7040);
  for (const t of route.structures ?? []) {
    if (t.kind !== 'tunnel') continue;
    const hl: number[] = []; for (let l = -150; l <= 154; l += 8) hl.push(l + TUNNEL_CENTER - 2);
    scene.add(gridAlong(track, t.from, t.to, 8, (s) => hl.map(l => [l, T.terrainY(s, l)] as [number, number]), hillMat,
      (s, j, out) => out.copy(forest).multiplyScalar(.8 + hash(Math.floor(s / 16), j) * .35)));
  }
  return T;
}
