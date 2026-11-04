// 線路をくぐる道路（OSM の tunnel=yes / layer が負の道路。scripts/osm-scenery.ts の underpasses）。
// 地上の線路の下を、OSM の道路の中心線に沿って掘り下げる（terrain.ts の terrainY がこの深さを引き、路面は osm-town.ts の道路が同じ深さに下りる）。
// 描くのは、線路の下のコンクリートの床版（函渠の頂版）と線路の両側の高欄、道路の両側の擁壁（線路の下は函渠の側壁、外は U 形の擁壁）と、擁壁の外の笠の帯。
// 地面は掘り下げの範囲だけ 1m 刻みの格子にする（terrain.ts）。深さ・勾配・壁の高さはゲーム用の概形（実際の寸法は不明）。座標は s-lat 平面（どちらも m）
import * as THREE from 'three';
import type { GameContext } from '../core/context';
import type { Route } from '../route/types';
import { loopZone, trackSpan } from '../route/service';
import { GeoBatch, M, P } from './batch';
import type { OsmData } from './osm-town';

type V2 = [number, number];

export interface Underpass {
  s: number; lat: number;
  /** 道路の中心線（s-lat）と、始点からの道のり */
  pts: V2[]; cum: number[];
  /** 道路の幅 [m]、歩道か */
  w: number; foot: boolean;
  /** 線路の下の路面の、地面からの深さ [m] */
  cut: number;
  /** 全部の深さの道のりの範囲（線路の帯の下）と、地面へ戻る坂の長さ [m] */
  a0: number; a1: number; ramp: number;
  /** 線路の帯（床版を置く横の範囲） */
  band: V2;
  /** 外接矩形（判定を速く） */
  s0: number; s1: number; l0: number; l1: number;
}

export interface UnderpassField {
  list: Underpass[];
  /** (s, lat) の掘り下げの深さ [m]（0 = なし） */
  depth(s: number, lat: number): number;
  /** 掘り下げのある s の範囲（地面を細かい格子で作る） */
  spans: [number, number][];
}

/** 線路の下の路面の深さ（線路面から）[m]: 車道は桁下 3.6m（床版 1.1m）、歩道は 2.5m。坂は車道 8%・歩道 12% */
const DEPTH_CAR = 4.7, DEPTH_FOOT = 3.6, SLOPE_CAR = .08, SLOPE_FOOT = .12;
/** 道路の縁から擁壁の中心まで、擁壁の厚さ [m]。地面は擁壁の外面の 1m 先まで全部の深さ（1m 刻みの格子の斜めの辺が擁壁より内に出ない）、
 *  その先 0.5m で地面に戻る。擁壁の外の段差は笠の帯（幅 COPING）で覆う */
const WALL = .6, WALL_T = .5, OUT_FULL = 1.0, OUT_FADE = .5, COPING = 2.1;

/** 道路の中心線の、道のり a の点と向き（s-lat の単位ベクトル） */
function pointAt(u: Pick<Underpass, 'pts' | 'cum'>, a: number): { p: V2; d: V2 } {
  const { pts, cum } = u, n = pts.length;
  let i = 0;
  while (i < n - 2 && cum[i + 1] < a) i++;
  const L = cum[i + 1] - cum[i] || 1, t = (a - cum[i]) / L;
  const d: V2 = [(pts[i + 1][0] - pts[i][0]) / L, (pts[i + 1][1] - pts[i][1]) / L];
  return { p: [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t], d };
}
/** 点 (s, lat) に最も近い中心線上の道のりと、中心線からの距離 */
function nearest(u: Pick<Underpass, 'pts' | 'cum'>, s: number, lat: number): { a: number; v: number } {
  let best = Infinity, ba = 0;
  for (let i = 0; i + 1 < u.pts.length; i++) {
    const [x0, y0] = u.pts[i], [x1, y1] = u.pts[i + 1], dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((s - x0) * dx + (lat - y0) * dy) / L2)), d = Math.hypot(s - x0 - dx * t, lat - y0 - dy * t);
    if (d < best) { best = d; ba = u.cum[i] + t * Math.sqrt(L2); }
  }
  return { a: ba, v: best };
}
const alongOf = (u: Underpass, a: number) => a >= u.a0 && a <= u.a1 ? 1 : Math.max(0, 1 - (a < u.a0 ? u.a0 - a : a - u.a1) / u.ramp);

/**
 * くぐる道路の一覧と掘り下げの深さ。高架・橋・トンネルの区間（もともと道路が下を通る）、駅のホーム・待避線の範囲（ホームの下の函渠は未対応）、
 * 線路が地面より十分高い所（盛土の下を通れる）は掘り下げない
 */
export function makeUnderpassField(route: Route, data: OsmData | null, trackY: (s: number) => number, dryY: (s: number) => number): UnderpassField {
  const list: Underpass[] = [];
  for (const row of data?.underpasses ?? []) {
    const [s, lat, w0, cls] = row as number[], flat = row[4] as number[];
    if (!flat || flat.length < 4) continue;
    if (s < route.extent.from + 30 || s > route.extent.to - 30) continue;
    if ((route.structures ?? []).some(x => s > x.from - 10 && s < x.to + 10)) continue;
    if (route.stations.some(st => { const z = loopZone(st); return s > Math.min(st.platform.from, z?.inFrom ?? Infinity) - 15 && s < Math.max(st.platform.to, z?.outTo ?? -Infinity) + 15; })) continue;
    const foot = cls === 4, w = Math.max(foot ? 2.5 : 4.5, Math.min(12, w0));
    const cut = (foot ? DEPTH_FOOT : DEPTH_CAR) - (trackY(s) - dryY(s));
    if (cut < .6) continue;
    const pts: V2[] = [];
    for (let i = 0; i < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const c0 = nearest({ pts, cum }, s, lat).a;
    // 線路の帯: 本線と並ぶ線路に加え、道路が下を通る構内（羽倉崎検車区など、景観を置かない範囲 reserved）も床版で覆う
    const [lo, hi] = trackSpan(route, s, 30), band: V2 = [lo - 3, hi + 3];
    const vw = w / 2 + WALL;
    const inBand = (a: number) => { const { p } = pointAt({ pts, cum }, a); return p[1] > band[0] - vw && p[1] < band[1] + vw; };
    const inReserved = (a: number) => { const { p } = pointAt({ pts, cum }, a); return (route.reserved ?? []).some(z => !z.keepRoads && p[0] > z.from && p[0] < z.to && p[1] > z.lat0 - vw && p[1] < z.lat1 + vw); };
    let a0 = c0, a1 = c0;
    while (a0 > 0 && (inBand(a0 - 1) || inReserved(a0 - 1))) a0--;
    while (a1 < cum[cum.length - 1] && (inBand(a1 + 1) || inReserved(a1 + 1))) a1++;
    // 構内の分も帯に含める（床版で覆う横の範囲）
    for (let a = a0; a <= a1; a += 1) { const { p } = pointAt({ pts, cum }, a); band[0] = Math.min(band[0], p[1] - vw + 1); band[1] = Math.max(band[1], p[1] + vw - 1); }
    const ramp = cut / (foot ? SLOPE_FOOT : SLOPE_CAR);
    const R = vw + WALL_T / 2 + OUT_FULL + OUT_FADE + COPING;
    let s0 = Infinity, s1 = -Infinity, l0 = Infinity, l1 = -Infinity;
    for (let a = Math.max(0, a0 - ramp); a <= Math.min(cum[cum.length - 1], a1 + ramp); a += 2) {
      const { p } = pointAt({ pts, cum }, a);
      s0 = Math.min(s0, p[0] - R); s1 = Math.max(s1, p[0] + R); l0 = Math.min(l0, p[1] - R); l1 = Math.max(l1, p[1] + R);
    }
    list.push({ s, lat, pts, cum, w, foot, cut, a0, a1, ramp, band, s0, s1, l0, l1 });
  }
  const depthOf = (u: Underpass, s: number, lat: number) => {
    const { a, v } = nearest(u, s, lat);
    const across = 1 - Math.min(1, Math.max(0, (v - (u.w / 2 + WALL + WALL_T / 2 + OUT_FULL)) / OUT_FADE));
    return across > 0 ? u.cut * alongOf(u, a) * across : 0;
  };
  return {
    list,
    depth: (s, lat) => {
      let d = 0;
      for (const u of list) if (s >= u.s0 && s <= u.s1 && lat >= u.l0 && lat <= u.l1) d = Math.max(d, depthOf(u, s, lat));
      return d;
    },
    spans: list.map(u => [u.s0 - 4, u.s1 + 4]),
  };
}

/** 床版・高欄・擁壁・笠の帯を描く（掘り下げは terrain.ts、路面は osm-town.ts の道路） */
export function buildUnderpasses(ctx: GameContext, field: UnderpassField, dryY: (s: number) => number): void {
  if (import.meta.env?.DEV) (globalThis as any).__underpasses = { field, dryY, trackY: (s: number) => ctx.track.trackAt(s).y };
  if (!field.list.length) return;
  const { track, scene } = ctx, b = new GeoBatch();
  const CONC = 0xb4b1a8, CAP = 0x9e9c95;
  const clampS = (s: number) => Math.max(ctx.route.extent.from, Math.min(ctx.route.extent.to, s));
  const world = (p: V2) => track.at(clampS(p[0]), p[1], 0);
  const g = (p: V2) => dryY(clampS(p[0]));
  const ty = (p: V2) => track.trackAt(clampS(p[0])).y;
  /** s-lat の2点の間の箱（下端 y0・高さ h・幅 t） */
  const box = (a: V2, c: V2, y0: number, h: number, t: number, col: number) => {
    const A = world(a), C = world(c), L = Math.hypot(C.x - A.x, C.z - A.z);
    if (L < .05 || h < .02) return;
    b.add('conc', P.boxB, M((A.x + C.x) / 2, y0, (A.z + C.z) / 2, Math.atan2(C.x - A.x, C.z - A.z), t, h, L + .04), col);
  };
  for (const u of field.list) {
    const vw = u.w / 2 + WALL, end = u.cum[u.cum.length - 1];
    const off = (a: number, v: number): V2 => { const { p, d } = pointAt(u, a); return [p[0] - d[1] * v, p[1] + d[0] * v]; };
    const STEP = 2;
    for (let a = Math.max(0, u.a0 - u.ramp); a < Math.min(end, u.a1 + u.ramp) - .01; a += STEP) {
      const a2 = Math.min(end, a + STEP), m = (a + a2) / 2, k = alongOf(u, m), under = m >= u.a0 && m <= u.a1;
      if (k < .03) continue;
      const pm = pointAt(u, m).p;
      for (const sd of [-1, 1]) {
        // 擁壁: 線路の帯の下は床版の下面まで（函渠の側壁）、外は地面から 0.9m 上まで（転落防止の壁を兼ねる）
        const floor = g(pm) - u.cut * k, top = under ? ty(pm) - 1.0 : g(pm) + .9;
        box(off(a, sd * vw), off(a2, sd * vw), floor - .3, top - floor + .3, WALL_T, CONC);
        // 笠の帯（擁壁の外。掘り下げの縁の段差を覆う）
        if (!under) {
          const v = vw + WALL_T / 2 + COPING / 2;
          box(off(a, sd * v), off(a2, sd * v), g(pm) - .02, .08, COPING, CAP);
        }
      }
      // 床版（函渠の頂版）: 線路の帯の下。上面は線路面（道床の下）。幅は掘り下げの全幅
      if (under) box(off(a, 0), off(a2, 0), ty(pm) - 1.0, .98, 2 * (vw + WALL_T / 2 + OUT_FULL + OUT_FADE + .3), CONC);
    }
    // 線路の両側の高欄（床版の縁。線路に沿う向き）: 道路の中心線が帯の縁を横切る所
    for (const edge of u.band) {
      for (let a = u.a0; a < u.a1; a += .5) {
        const p = pointAt(u, a).p, q = pointAt(u, a + .5).p;
        if ((p[1] - edge) * (q[1] - edge) > 0) continue;
        const d = pointAt(u, a).d, sa = Math.max(.35, Math.abs(d[1])), half = (vw + WALL_T / 2 + OUT_FULL + OUT_FADE + .3) / sa;
        const out = edge === u.band[0] ? -.15 : .15;
        box([p[0] - half, edge + out], [p[0] + half, edge + out], ty(p) - .1, 1.1, .3, CONC);
        break;
      }
    }
  }
  b.build({ conc: new THREE.MeshLambertMaterial({ vertexColors: true }) }, scene);
}
