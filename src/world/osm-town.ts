// OpenStreetMap から作った沿線データ（src/data/osm/*.json、scripts/osm-scenery.ts）で、線路の両側 約300m の街並みを描く。
// 建物は外接長方形（向き・階数・種類）から、線路に近いものは town-jp.ts の住宅・アパート・マンション・商店の部品で、
// 遠いものは箱と屋根だけで作る。道路・公園・緑地・川・墓地は地面に貼り、森・公園・社寺の敷地には木を植える。
// データの座標はデータを作ったコース（'namba' = 堺 → なんば など）のもの。走るコース（下り・通しコース）へは、
// 共通の駅の位置をそろえて s を写し、向きが逆なら横位置を鏡像にする（osmFor）。
// ctx.rng は使わない（独自の乱数）。出典: © OpenStreetMap contributors（ODbL）
import * as THREE from 'three';
import type { GameContext } from '../core/context';
import { createRng } from '../core/rng';
import { ChunkedBatch, GeoBatch, M, P } from './batch';
import { loopShape, loopZones, trackLines, trackSpan } from '../route/service';
import { getTerrain, hash } from './terrain';
import { tramBlocks } from './hankai-tram';
import { towerZones } from './coastal-tower';
import { coastalThirdTracks } from './coastal-stations';
import { twinTowerZones } from './izumiotsu-towers';
import type { TreeSpot } from './town-jp';
import type { Route } from '../route/types';
import { namba } from '../route/routes/namba';
import { shiokaze } from '../route/routes/shiokaze';
import { kishiwada } from '../route/routes/kishiwada';
import { izumisano } from '../route/routes/izumisano';
import nambaData from '../data/osm/namba.json';
import sakaiIzumiotsuData from '../data/osm/sakai-izumiotsu.json';
import izumiotsuKishiwadaData from '../data/osm/izumiotsu-kishiwada.json';
import kishiwadaIzumisanoData from '../data/osm/kishiwada-izumisano.json';

export interface OsmData {
  source: string;
  /** [s, lat, 長さ, 幅, 角度(度), 階数, 種類の文字コード] */
  buildings: number[][];
  /** [等級, 幅, 名前, s,lat の並び] */
  roads: (number | string | number[])[][];
  /** [種類, s,lat の並び] */
  areas: (string | number[])[][];
  /** 高架の都市高速 [幅, s,lat,高さ の並び] */
  highways?: (number | number[])[][];
  landmarks: (string | number)[][];
}

/** データと、その座標のもとになったコース */
const DATASETS: { id: string; base: Route; data: OsmData }[] = [
  { id: 'namba', base: namba, data: nambaData as unknown as OsmData },
  { id: 'sakai-izumiotsu', base: shiokaze, data: sakaiIzumiotsuData as unknown as OsmData },
  { id: 'izumiotsu-kishiwada', base: kishiwada, data: izumiotsuKishiwadaData as unknown as OsmData },
  { id: 'kishiwada-izumisano', base: izumisano, data: kishiwadaIzumisanoData as unknown as OsmData },
];

const cache = new WeakMap<Route, OsmData | null>();

/**
 * 走るコースの座標へ写したデータ（共通の駅が2つ以上あるデータを合わせる）。無ければ null。
 * 区間データをつないだ通しコースでは、つなぎ目の駅の中心で各データを切って重ならないようにする
 */
export function osmFor(route: Route): OsmData | null {
  if (cache.has(route)) return cache.get(route)!;
  const out: OsmData = { source: '', buildings: [], roads: [], areas: [], landmarks: [], highways: [] };
  let any = false;
  const center = (st: Route['stations'][number]) => (st.platform.from + st.platform.to) / 2;
  for (const ds of DATASETS) {
    const pairs = ds.base.stations.map((st, i) => ({ b: center(st), j: route.stations.findIndex(x => x.name === st.name), i }))
      .filter(p => p.j >= 0);
    if (pairs.length < 2) continue;
    const rev = pairs[1].j < pairs[0].j;
    const B = pairs.map(p => p.b), Tt = pairs.map(p => center(route.stations[p.j]));
    const last = route.stations.length - 1;
    const atEnd = (j: number) => j === 0 || j === last;
    // データの範囲（データの座標）: 共通の駅の外側は、走るコースの端の駅なら全部、つなぎ目なら駅の中心まで
    const lo = atEnd(pairs[0].j) ? -Infinity : B[0], hi = atEnd(pairs[pairs.length - 1].j) ? Infinity : B[B.length - 1];
    const mapS = (sb: number) => {
      if (sb <= B[0]) return Tt[0] + (sb - B[0]) * (rev ? -1 : 1);
      for (let k = 0; k + 1 < B.length; k++) if (sb <= B[k + 1]) return Tt[k] + (Tt[k + 1] - Tt[k]) * (sb - B[k]) / (B[k + 1] - B[k]);
      return Tt[Tt.length - 1] + (sb - B[B.length - 1]) * (rev ? -1 : 1);
    };
    const C = Math.min(...ds.base.tracks) + Math.max(...ds.base.tracks);
    const mapL = (l: number) => rev ? C - l : l;
    const inR = (sb: number) => sb >= lo && sb <= hi;
    for (const b of ds.data.buildings) if (inR(b[0])) out.buildings.push([mapS(b[0]), mapL(b[1]), ...b.slice(2)]);
    for (const r of ds.data.roads) {
      const pts = r[3] as number[], keep: number[] = [];
      const flush = () => { if (keep.length >= 4) out.roads.push([r[0], r[1], r[2], keep.slice()]); keep.length = 0; };
      for (let i = 0; i < pts.length; i += 2) { if (inR(pts[i])) keep.push(mapS(pts[i]), mapL(pts[i + 1])); else flush(); }
      flush();
    }
    for (const h of ds.data.highways ?? []) {
      const pts = h[1] as number[], keep: number[] = [];
      const flush = () => { if (keep.length >= 6) out.highways!.push([h[0], rev ? reverseTriples(keep) : keep.slice()]); keep.length = 0; };
      for (let i = 0; i < pts.length; i += 3) { if (inR(pts[i])) keep.push(mapS(pts[i]), mapL(pts[i + 1]), pts[i + 2]); else flush(); }
      flush();
    }
    for (const a of ds.data.areas) {
      let poly: [number, number][] = [];
      const pts = a[1] as number[];
      for (let i = 0; i < pts.length; i += 2) poly.push([pts[i], pts[i + 1]]);
      if (lo > -Infinity) poly = clipS(poly, lo, 1);
      if (hi < Infinity) poly = clipS(poly, hi, -1);
      if (poly.length < 3) continue;
      const flat = poly.flatMap(([sb, l]) => [mapS(sb), mapL(l)]);
      out.areas.push([a[0], rev ? reversePairs(flat) : flat]);
    }
    for (const m of ds.data.landmarks) if (inR(m[1] as number)) out.landmarks.push([m[0], mapS(m[1] as number), mapL(m[2] as number)]);
    out.source = ds.data.source;
    any = true;
  }
  out.buildings.sort((a, b) => a[0] - b[0]);
  const res = any ? out : null;
  cache.set(route, res);
  return res;
}

/** 多角形を s = v で切る（keep = 1: v 以上を残す、-1: v 以下） */
function clipS(poly: [number, number][], v: number, keep: 1 | -1): [number, number][] {
  const out: [number, number][] = [], inside = (p: [number, number]) => (p[0] - v) * keep >= 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], ia = inside(a), ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) { const t = (v - a[0]) / (b[0] - a[0]); out.push([v, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}
function reverseTriples(f: number[]): number[] {
  const out: number[] = [];
  for (let i = f.length - 3; i >= 0; i -= 3) out.push(f[i], f[i + 1], f[i + 2]);
  return out;
}
/** s,lat の並びの順を逆に（鏡像で反時計回りが時計回りになるのを戻す） */
function reversePairs(f: number[]): number[] {
  const out: number[] = [];
  for (let i = f.length - 2; i >= 0; i -= 2) out.push(f[i], f[i + 1]);
  return out;
}

/** このコースの景観を OSM データで作るか */
export function hasOsmScenery(ctx: GameContext): boolean {
  return !!osmFor(ctx.route);
}

/** 部品の作り手（town-jp.ts から渡す） */
export interface OsmKit {
  /** 近景の建物（部品で詳しく作る。近くだけ描く） */
  detail: ChunkedBatch;
  /** 箱と屋根だけの建物・地面（遠くまで描く） */
  chunks: ChunkedBatch;
  shadowChunks: ChunkedBatch;
  /** 局所座標で部品を積む道具（town-jp の Kit） */
  kit(b: GeoBatch, rnd: () => number): unknown;
  house(k: unknown, w: number, d: number): void;
  apartment(k: unknown, w: number, d: number): void;
  mansion(k: unknown, w: number, d: number, floors: number): void;
  shop(k: unknown, w: number, d: number): void;
}

/** 近景（部品で詳しく作る）の範囲: 線路の端からの距離 [m] */
const NEAR = 45;
/** 木の本数の上限（コース 1km あたり・全体） */
const TREE_PER_KM = 150, TREE_CAP = 2400;

const WALL = [0xe9e2cf, 0xf0efe9, 0xd9c9a8, 0xcfcfca, 0xb39673, 0xbfc6cc, 0xe3d3bb, 0xd8d0c4, 0xa7aeb3, 0xeee6d6];
const ROOF = [0x3c3f45, 0x4a5561, 0x5e4436, 0x3b4c62, 0x6b6e73, 0x55595e];
const BLOCK = [0xc9c2b4, 0xb9b4aa, 0xd2cfc7, 0xa9aaa6, 0xc4b9a5, 0xb3b9bd, 0xd8d2c4, 0xbfc3c4];
const AREA_COL: Record<string, number> = {
  park: 0x7e9e5c, grass: 0x8aa863, pitch: 0x9a9070, school: 0xb4a888, grave: 0xa3a39b, shrine: 0xb9b49e, wood: 0x56733f, water: 0x5f8797, lot: 0x8e8e88,
};

export interface OsmTownResult {
  /** 道路が通っている場所（線路沿いの道路の代わり） */
  roadCount: number;
  buildings: number;
}

/** 沿線の街並みを積む（data は osmFor で走るコースの座標へ写したもの） */
export function buildOsmTown(ctx: GameContext, data: OsmData, K: OsmKit, trees: TreeSpot[]): OsmTownResult {
  const { track, route } = ctx, T = getTerrain(ctx);
  const toReal = (s: number, lat: number): [number, number] => [s, lat];
  const rnd = createRng(4242);
  const S0 = route.extent.from - 60, S1 = route.extent.to + 60;
  const reserved = route.reserved ?? [];
  const inReserved = (s0: number, s1: number, l0: number, l1: number) => reserved.some(z => s0 < z.to && s1 > z.from && l0 < z.lat1 && l1 > z.lat0);
  // 線路の端（本線と、並んで走る追加の線路）。この外へ 4m 以上離れた所だけ使う
  const spanCache = new Map<number, [number, number]>();
  const span = (s: number) => {
    const k = Math.round(s / 10);
    let v = spanCache.get(k);
    if (!v) { v = trackSpan(route, k * 10, 30); spanCache.set(k, v); }
    return v;
  };
  const gap = (s: number, lat: number) => { const [lo, hi] = span(s); return lat < lo ? lo - lat : lat > hi ? lat - hi : -1; };
  // すべての線路（追加の線路・支線を含む）の中心から 4.5m の帯に建物を入れない
  const L0 = Math.min(...route.tracks), L1 = Math.max(...route.tracks);
  const lines = [
    ...trackLines(route),
    // 2面4線駅の待避線（自線側は左、対向線側は右へ開く）
    ...loopZones(route).flatMap(z => [
      { from: z.inFrom, to: z.outTo, lat: (q: number) => L0 + z.lat * loopShape(z, q) },
      { from: z.inFrom, to: z.outTo, lat: (q: number) => L1 - z.lat * loopShape(z, q) },
    ]),
    // 浜寺公園の副線・羽衣の3番線（分岐器を含む）
    ...route.stations.flatMap(st => coastalThirdTracks(route, st)).map(t => ({ from: t.from - 60, to: t.to + 60, lat: t.lat })),
  ];
  const nearLine = (s0: number, s1: number, l0: number, l1: number) => {
    for (let q = s0 - 2; q <= s1 + 2; q += Math.max(2, (s1 - s0 + 4) / 6)) for (const ln of lines) {
      if (q < ln.from || q > ln.to) continue;
      const c = ln.lat(q);
      if (c > l0 - 4.5 && c < l1 + 4.5) return true;
    }
    return false;
  };
  // 他のモジュールの敷地: 地上駅の駅舎・駅前（ホームの前後 12m、線路から 24m。待避線のある駅は 44m）、
  // 駅直結のタワー、道路の跨線橋、阪堺線・高師浜線の高架
  const towers = [...towerZones(route), ...twinTowerZones(route)];
  const overpasses = (route.coastalLandmarks ?? []).filter(l => l.kind === 'road-overpass').map(l => l.s);
  const elevated = (s: number) => T.trackY(s) - T.groundY(s) > 3;
  const blocked = (s0: number, s1: number, l0: number, l1: number, g: number, road = false) => {
    const s = (s0 + s1) / 2, [a, b] = span(s), sd = (l0 + l1) / 2 < (a + b) / 2 ? -1 : 1;
    if (towers.some(t => t.side === sd && s0 < t.to && s1 > t.from)) return true;
    if (overpasses.some(o => s0 < o + 45 && s1 > o - 45)) return true;
    if (tramBlocks(route, s0, s1, l0, l1, road)) return true;
    for (const st of route.stations) {
      if (s1 < st.platform.from - 12 || s0 > st.platform.to + 12) continue;
      if (g < (elevated(s) ? 12 : st.loop ? 44 : 24)) return true;
    }
    return false;
  };

  // 世界座標の向き: s 方向に対し角度 a（s 軸から lat 軸へ）の方向ベクトル
  const dirAt = (s: number, a: number) => {
    const t = track.trackAt(s), fx = Math.sin(t.phi), fz = -Math.cos(t.phi);
    return { x: Math.cos(a) * fx + Math.sin(a) * t.rx, z: Math.cos(a) * fz + Math.sin(a) * t.rz };
  };
  const ground = (s: number) => T.groundY(Math.max(route.extent.from, Math.min(route.extent.to, s)));

  // 川（route.structures の橋の下は地面が下がって水面がある）と OSM の水面: 建物を置かない
  const bridges = (route.structures ?? []).filter(x => x.kind === 'bridge');
  const inRiver = (s: number, m = 0) => bridges.some(x => s > x.from - m && s < x.to + m);
  const inPolyF = (pts: number[], ps: number, pl: number) => {
    let c = false;
    for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
      const si = pts[i], li = pts[i + 1], sj = pts[j], lj = pts[j + 1];
      if ((li > pl) !== (lj > pl) && ps < (sj - si) * (pl - li) / (lj - li) + si) c = !c;
    }
    return c;
  };
  /** 面の外接矩形つき（判定を速く） */
  const polys = data.areas.map(x => {
    const pts = x[1] as number[];
    let s0 = Infinity, s1 = -Infinity, l0 = Infinity, l1 = -Infinity;
    for (let i = 0; i < pts.length; i += 2) { s0 = Math.min(s0, pts[i]); s1 = Math.max(s1, pts[i]); l0 = Math.min(l0, pts[i + 1]); l1 = Math.max(l1, pts[i + 1]); }
    return { type: x[0] as string, pts, s0, s1, l0, l1 };
  });
  const inArea = (ps: number, pl: number, types?: Set<string>) => polys.some(q => (!types || types.has(q.type)) && ps >= q.s0 && ps <= q.s1 && pl >= q.l0 && pl <= q.l1 && inPolyF(q.pts, ps, pl));
  const WATER = new Set(['water']);
  const NOFILL = new Set(['water', 'park', 'wood', 'grass', 'pitch', 'school', 'grave', 'shrine', 'lot']);

  // ================= 建物 =================
  const roadNear0 = buildRoadIndex(data);
  // 空き地の補い: OSM の建物・道路・面のない所に、線路沿いの住宅を間をあけて置く（密集させすぎない）
  const occ = new Set<string>();
  const C8 = 8, ck = (s: number, l: number) => `${Math.floor(s / C8)},${Math.floor(l / C8)}`;
  /** 置ける建物か（線路・専用モジュールの敷地・駅前・川・道路を避ける） */
  const placeable = (row: number[]) => {
    const [s, lat, len, wid, angDeg] = row;
    if (s < S0 || s > S1) return false;
    const a = angDeg * Math.PI / 180, half = Math.max(len, wid) / 2, g = gap(s, lat);
    // 線路（本線・ホーム・分かれていく線路・入出庫線）との離隔: 建物の外形の s 方向・横方向の張り出しで測る
    const hs = (len * Math.abs(Math.cos(a)) + wid * Math.abs(Math.sin(a))) / 2, hl = (len * Math.abs(Math.sin(a)) + wid * Math.abs(Math.cos(a))) / 2;
    if (g < hl + 4) return false; // 本線群の帯にかかる
    if (nearLine(s - hs, s + hs, lat - hl, lat + hl)) return false;
    if (inReserved(s - half, s + half, lat - half, lat + half)) return false; // 専用モジュールの敷地（駅ビル・車庫・商業施設）
    if (blocked(s - half, s + half, lat - half, lat + half, g)) return false;
    if (inRiver(s - hs, 6) || inRiver(s + hs, 6) || inArea(s, lat, WATER)) return false; // 川・池の上
    if (half < 12 && roadNear0(s, lat)) return false; // 写し方のずれで道路に載った小さな建物
    return true;
  };
  const osmB = data.buildings.filter(placeable);
  for (const bd of osmB) {
    // 建物の外形（向きのある長方形）＋ 2m
    const a = bd[4] * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), hu = bd[2] / 2 + 2, hv = bd[3] / 2 + 2;
    for (let u = -hu; u <= hu + .01; u += Math.min(C8 / 2, hu)) for (let v = -hv; v <= hv + .01; v += Math.min(C8 / 2, hv)) occ.add(ck(bd[0] + u * ca - v * sa, bd[1] + u * sa + v * ca));
  }
  const filler: number[][] = [];
  {
    const frnd = createRng(777);
    for (const sd of [-1, 1]) for (let cs = S0 + 6; cs < S1; cs += 12) {
      const [lo, hi] = span(cs);
      for (let d = 13; d < 200; d += 12.5) {
        const cl = sd < 0 ? lo - d : hi + d;
        const p = d < 70 ? .58 : .45; // 線路沿いは建て込み、奥はまばら
        if (frnd() > p) continue;
        let free = true;
        for (const [ds, dl] of [[0, 0], [-5, -4], [5, -4], [-5, 4], [5, 4]]) {
          if (occ.has(ck(cs + ds, cl + dl)) || roadNear0(cs + ds, cl + dl)) { free = false; break; }
        }
        if (!free || inArea(cs, cl, NOFILL)) continue;
        const apt = frnd() < (d < 60 ? .14 : .08);
        const w = apt ? 14 : 8 + frnd() * 2.5, dep = apt ? 9 : 7 + frnd() * 2;
        const row = [cs + (frnd() - .5) * 2, cl + (frnd() - .5) * 2, w, dep, 0, apt ? 3 : 2, (apt ? 'a' : 'h').charCodeAt(0)];
        if (!placeable(row)) continue;
        filler.push(row);
        occ.add(ck(cs, cl));
      }
    }
  }
  // 建物の登録がない学校の敷地には校舎（4階の横長の棟）を1棟置く
  for (const q of polys) {
    if (q.type !== 'school' || (q.s1 - q.s0) * (q.l1 - q.l0) < 3000) continue;
    if (data.buildings.some(b => b[0] > q.s0 && b[0] < q.s1 && b[1] > q.l0 && b[1] < q.l1 && inPolyF(q.pts, b[0], b[1]))) continue;
    // 線路から遠い側の端寄り（校庭を線路側に残す）
    const cs = (q.s0 + q.s1) / 2, far = Math.abs(q.l0) > Math.abs(q.l1) ? q.l0 + 12 : q.l1 - 12;
    if (!inPolyF(q.pts, cs, far)) continue;
    const row = [cs, far, Math.min(70, (q.s1 - q.s0) * .7), 13, 0, 4, 'p'.charCodeAt(0)];
    if (placeable(row)) filler.push(row);
  }
  // 駐車場には車を並べる（線路から 180m まで。空き地に見えないように）
  {
    const crnd = createRng(31337), CAR = [0xf2f2ef, 0x2b2d30, 0x9aa0a6, 0x6e7a86, 0xb8342c, 0x2f4f7f, 0xd9d4c4, 0x50565c];
    let nCar = 0;
    for (const q of polys) {
      if (q.type !== 'lot' || nCar > 2500) continue;
      for (let s = q.s0 + 3; s < q.s1 - 2; s += 2.8) for (let l = q.l0 + 4; l < q.l1 - 3; l += 6.5) {
        if (crnd() < .38 || !inPolyF(q.pts, s, l) || gap(s, l) < 8 || gap(s, l) > 180 || inReserved(s - 2, s + 2, l - 3, l + 3) || nearLine(s - 2, s + 2, l - 3, l + 3) || roadNear0(s, l)) continue;
        const p = track.at(s, l, 0), t = track.trackAt(s), b = K.chunks.at(s); b.parent = null;
        const col = CAR[Math.floor(crnd() * CAR.length)], yaw = -t.phi; // 長さ（局所 x）を線路に直角に
        b.add('body', P.boxB, M(p.x, ground(s) + .15, p.z, yaw, 4.3, .8, 1.7), col);
        b.add('body', P.boxB, M(p.x, ground(s) + .95, p.z, yaw, 2.4, .55, 1.55), 0x3a4048);
        nCar++;
      }
    }
  }
  // 開発時の確認用: ある位置に建物を置かない理由
  if (import.meta.env?.DEV) (globalThis as any).__osmWhy = (s: number, l: number) => ({ g: gap(s, l), near: nearLine(s - 4, s + 4, l - 4, l + 4), reserved: inReserved(s - 4, s + 4, l - 4, l + 4), blocked: blocked(s - 4, s + 4, l - 4, l + 4, gap(s, l)), occ: occ.has(ck(s, l)), road: roadNear0(s, l), areas: polys.filter(q => s >= q.s0 && s <= q.s1 && l >= q.l0 && l <= q.l1 && inPolyF(q.pts, s, l)).map(q => q.type) });
  let nB = 0;
  for (const row of [...osmB, ...filler]) {
    const [s, lat, len, wid, angDeg, lv0, tc] = row;
    const a = angDeg * Math.PI / 180;
    const type = String.fromCharCode(tc), g = gap(s, lat);
    nB++;
    const lv = Math.min(45, Math.max(1, lv0));
    const sd = lat < (span(s)[0] + span(s)[1]) / 2 ? -1 : 1;
    const p = track.at(s, lat, 0), y = ground(s);
    // 正面（局所 -Z）を線路へ向ける: 局所 Z = 線路から離れる向き（長さの軸に直交）
    const d2 = dirAt(s, a + Math.PI / 2), away = sd < 0 ? -1 : 1;
    const ry = Math.atan2(d2.x * away, d2.z * away);
    const parent = new THREE.Matrix4().compose(new THREE.Vector3(p.x, y, p.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1));
    const w = Math.max(3, len), d = Math.max(3, wid);
    const near = g < NEAR, detailed = near && !(type === 'i' || type === 'p' || type === 'r' || type === 'g' || w >= 60);
    const b = (detailed ? K.detail : K.chunks).at(s);
    // 接地影（近景のみ）
    if (near) { const sb = K.shadowChunks.at(s); sb.parent = parent; sb.add('shadow', P.plane, M(0, .025, 0, 0, w + 4, d + 4, 1, -Math.PI / 2)); }
    b.parent = parent;
    const h = hash(Math.round(s * 7), Math.round(lat * 3));
    if (near && type === 'h' && w < 16 && d < 16) { K.house(K.kit(b, rnd), Math.min(w, 13), Math.min(d, 12)); continue; }
    if (near && (type === 'a' || type === 'h') && lv <= 3 && w < 40) { K.apartment(K.kit(b, rnd), w, d); continue; }
    if (near && type === 'c' && lv <= 3 && w < 24) { K.shop(K.kit(b, rnd), w, d); continue; }
    if (near && (type === 'a' || type === 'c') && lv >= 4 && w < 60 && d < 30) { K.mansion(K.kit(b, rnd), w, d, lv); continue; }
    // 箱と屋根だけ（遠景・大きな建物・工場・社寺・学校）
    const H = type === 'h' ? .35 + lv * 2.8 : type === 'i' ? 6 + lv * 1.5 : .4 + lv * 3.1;
    let wall = type === 'h' ? WALL[Math.floor(h * WALL.length)] : BLOCK[Math.floor(h * BLOCK.length)];
    if (type === 'i') wall = 0xb7bcbd;
    if (type === 'p') wall = 0xe3dfd2;
    if (type === 'r') wall = 0xd9cdb8;
    b.add('body', P.boxB, M(0, 0, 0, 0, w, H, d), wall);
    if (type === 'h' || type === 'r' || type === 'g') {
      // 切妻（社寺は濃い色の大きな屋根）
      const rh = Math.min(w, d) * (type === 'r' ? .45 : .32), along = w >= d;
      b.add('body', P.gable, M(0, H, 0, along ? Math.PI / 2 : 0, (along ? d : w) + .8, rh, (along ? w : d) + .8), type === 'r' ? 0x3b3a36 : ROOF[Math.floor(h * 17 % 1 * ROOF.length)]);
    } else if (type === 'i') {
      // 工場: ゆるい切妻の屋根
      b.add('body', P.gable, M(0, H, 0, w >= d ? Math.PI / 2 : 0, Math.min(w, d) + .4, 1.6, Math.max(w, d) + .4), 0x8d9497);
    } else {
      // 陸屋根: パラペットと塔屋
      b.add('body', P.boxB, M(0, H, 0, 0, w + .2, .7, d + .2), 0xa8a59d);
      if (lv >= 4 && w > 10) b.add('body', P.boxB, M(w * .2, H + .7, 0, 0, Math.min(5, w * .3), 2.4, Math.min(5, d * .4)), 0xc8c8c4);
      // 窓の帯（線路側の面、近い大きな建物だけ）
      if (g < 160 && lv >= 2) {
        const n = Math.min(lv, 14), wins = Math.max(1, Math.floor(w / 4));
        for (let f = 1; f < n; f++) {
          const yy = .4 + f * 3.1 + 1.4;
          b.add(rnd() < .4 ? 'lit' : 'body', P.plane, M(0, yy, -d / 2 - .03, Math.PI, w * .86, 1.2, 1), 0x2b343d);
          if (wins > 1 && f === 1) for (let i = 1; i < wins; i++) b.add('body', P.box, M(-w / 2 + i * w / wins, .4 + n * 1.55, -d / 2 - .06, 0, .18, n * 3.1, .08), wall);
        }
      }
    }
  }

  // ================= 地面: 道路・公園・緑地・川 =================
  // 川を渡る道路は、川の手前の地面の高さで橋にする
  const bankY = (s: number) => {
    const x = bridges.find(q => s > q.from - 4 && s < q.to + 4);
    return x ? Math.max(ground(x.from - 12), ground(x.to + 12)) + .5 : null;
  };
  const lift = (s: number) => ground(s);
  const liftRoad = (s: number) => bankY(s) ?? ground(s);
  /** s-lat の折れ線を幅 w の帯にする（20m ごとに分けて線路の曲がりに沿わせる）。caps = 端と曲がり角に円盤を足してつなぎ目を埋める */
  const ribbon = (b: GeoBatch, pts: number[], w: number, dy: number, col: number, caps = false) => {
    const P2: [number, number][] = [];
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const s0 = pts[i], l0 = pts[i + 1], s1 = pts[i + 2], l1 = pts[i + 3];
      const n = Math.max(1, Math.ceil(Math.hypot(s1 - s0, l1 - l0) / 20));
      for (let k = i ? 1 : 0; k <= n; k++) P2.push([s0 + (s1 - s0) * k / n, l0 + (l1 - l0) * k / n]);
    }
    const tris: number[] = [];
    const W = (s: number, lat: number) => { const v = track.at(s, lat, 0); v.y = liftRoad(s) + dy; return v; };
    const Wp = P2.map(([q, l]) => W(q, l));
    for (let i = 0; i + 1 < P2.length; i++) {
      const A = Wp[i], B = Wp[i + 1], dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz) || 1;
      const nx = -dz / L * w / 2, nz = dx / L * w / 2;
      const a1 = [A.x + nx, A.y, A.z + nz], a2 = [A.x - nx, A.y, A.z - nz], b1 = [B.x + nx, B.y, B.z + nz], b2 = [B.x - nx, B.y, B.z - nz];
      tris.push(...a1, ...b1, ...a2, ...a2, ...b1, ...b2);
    }
    if (caps) {
      for (let i = 0; i < Wp.length; i++) {
        let need = i === 0 || i === Wp.length - 1;
        if (!need) {
          const A = Wp[i - 1], B = Wp[i], C = Wp[i + 1];
          const a1 = Math.atan2(B.z - A.z, B.x - A.x), a2 = Math.atan2(C.z - B.z, C.x - B.x);
          let da = Math.abs(a2 - a1); if (da > Math.PI) da = 2 * Math.PI - da;
          need = da > .2;
        }
        if (!need) continue;
        const c = Wp[i], N = 8;
        for (let k = 0; k < N; k++) {
          const t0 = k / N * Math.PI * 2, t1 = (k + 1) / N * Math.PI * 2;
          tris.push(c.x, c.y, c.z, c.x + Math.cos(t0) * w / 2, c.y, c.z + Math.sin(t0) * w / 2, c.x + Math.cos(t1) * w / 2, c.y, c.z + Math.sin(t1) * w / 2);
        }
      }
    }
    upFacing(tris);
    if (tris.length) b.addTris('road', tris, col);
  };
  let nR = 0;
  const ROAD_COL = [0x4f5257, 0x4f5257, 0x585b60, 0x65676b];
  for (const r of data.roads) {
    const cls = r[0] as number, w = Math.min(cls === 1 ? 22 : 14, Math.max(cls === 3 ? 4.5 : 6, r[1] as number)), pts = r[3] as number[];
    if (pts.length < 4) continue;
    // 高架の下を通る道路はそのまま。地上の線路を横切る所（踏切は crossings.ts）・駅前・タワーの敷地では切る
    const pieces: number[][] = []; let cur: number[] = [];
    for (let i = 0; i < pts.length; i += 2) {
      const ps = pts[i], pl = pts[i + 1], g = gap(ps, pl);
      const bad = (!elevated(ps) && g < w / 2 + 3) || blocked(ps - 1, ps + 1, pl - 1, pl + 1, Math.max(0, g - w / 2), true) || inReserved(ps - 1, ps + 1, pl - 1, pl + 1);
      if (bad) { if (cur.length >= 4) pieces.push(cur); cur = []; } else cur.push(ps, pl);
    }
    if (cur.length >= 4) pieces.push(cur);
    for (const pc of pieces) {
      const b = K.chunks.at(pc[0]); b.parent = null;
      // 等級ごとに高さを分けて重なりのちらつきを防ぐ（広い道が上）
      ribbon(b, pc, w, .09 + (3 - cls) * .012, ROAD_COL[cls], true);
      if (cls <= 2 && w >= 7) for (const off of [-w / 2 + .5, w / 2 - .5]) ribbon(b, offsetLine(pc, off), .15, .14, 0xe2e2dc);
      // 川を渡る所は橋桁と橋脚
      for (let i = 0; i + 3 < pc.length; i += 2) {
        const sa = pc[i], sb = pc[i + 2], y = bankY((sa + sb) / 2);
        if (y == null) continue;
        const A = track.at(sa, pc[i + 1], 0), B = track.at(sb, pc[i + 3], 0), L = Math.hypot(B.x - A.x, B.z - A.z);
        if (L < .5) continue;
        const yaw = Math.atan2(B.x - A.x, B.z - A.z), mx = (A.x + B.x) / 2, mz = (A.z + B.z) / 2, cx = Math.cos(yaw), sx = Math.sin(yaw);
        b.add('body', P.box, M(mx, y - .55, mz, yaw, w + .6, 1.2, L + .2), 0xa5a49c);
        for (const sd of [-1, 1]) b.add('body', P.box, M(mx + cx * sd * (w / 2 + .15), y + .55, mz - sx * sd * (w / 2 + .15), yaw, .3, 1.0, L + .2), 0xc9c8c0);
        const gy = ground((sa + sb) / 2);
        if (y - gy > 1.5) b.add('body', P.boxB, M(mx, gy - .5, mz, yaw, w * .6, y - gy - .6, 1.6), 0x9c9b93);
      }
    }
    nR++;
  }
  // 高架の都市高速（阪神高速など）
  const buildHighway = (w: number, pts: number[]) => {
    const n = pts.length / 3;
    const P3: { s: number; l: number; h: number }[] = [];
    for (let i = 0; i < n; i++) P3.push({ s: pts[i * 3], l: pts[i * 3 + 1], h: pts[i * 3 + 2] });
    // 細かく分ける（線路の曲がりに沿わせる）
    const Q: { s: number; l: number; h: number; skip?: boolean }[] = [];
    for (let i = 0; i + 1 < P3.length; i++) {
      const a = P3[i], c = P3[i + 1], m = Math.max(1, Math.ceil(Math.hypot(c.s - a.s, c.l - a.l) / 10));
      for (let k = i ? 1 : 0; k <= m; k++) Q.push({ s: a.s + (c.s - a.s) * k / m, l: a.l + (c.l - a.l) * k / m, h: a.h + (c.h - a.h) * k / m });
    }
    // 線路の上・近くは架線の上を越える高さへ上げ、前後は 6% の勾配でならす。地上へ下りるランプが線路に近い所は描かない
    const sc = (q: number) => Math.max(route.extent.from, Math.min(route.extent.to, q));
    for (const q of Q) {
      if (gap(q.s, q.l) > w / 2 + 15 && !nearLine(q.s - w / 2 - 6, q.s + w / 2 + 6, q.l - w / 2 - 6, q.l + w / 2 + 6)) continue;
      if (q.h < 4) { q.skip = true; continue; }
      q.h = Math.max(q.h, T.trackY(sc(q.s)) - ground(q.s) + 10);
    }
    const dist = (a: { s: number; l: number }, b: { s: number; l: number }) => Math.hypot(a.s - b.s, a.l - b.l);
    for (let i = 1; i < Q.length; i++) if (Q[i].h > 4) Q[i].h = Math.max(Q[i].h, Q[i - 1].h - .06 * dist(Q[i], Q[i - 1]));
    for (let i = Q.length - 2; i >= 0; i--) if (Q[i].h > 4) Q[i].h = Math.max(Q[i].h, Q[i + 1].h - .06 * dist(Q[i], Q[i + 1]));
    let acc = 30;
    for (let i = 0; i + 1 < Q.length; i++) {
      const a = Q[i], c = Q[i + 1];
      if (a.s < S0 || a.s > S1 || a.skip || c.skip) continue;
      const A = track.at(a.s, a.l, 0), B = track.at(c.s, c.l, 0);
      A.y = ground(a.s) + a.h; B.y = ground(c.s) + c.h;
      const dx = B.x - A.x, dz = B.z - A.z, dyv = B.y - A.y, L = Math.hypot(dx, dz);
      if (L < .5) continue;
      const yaw = Math.atan2(dx, dz), pitch = -Math.atan2(dyv, L), mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, mz = (A.z + B.z) / 2;
      const b = K.chunks.at(a.s); b.parent = null;
      const Ls = Math.hypot(L, dyv) + .3, cx = Math.cos(yaw), sx = Math.sin(yaw);
      b.add('body', P.box, M(mx, my - .9, mz, yaw, w, 1.8, Ls, pitch), 0x9fa09a);           // 桁
      b.add('body', P.box, M(mx, my + .02, mz, yaw, w - .6, .08, Ls, pitch), 0x505357);    // 舗装
      for (const sd of [-1, 1]) b.add('body', P.box, M(mx + cx * sd * (w / 2 - .2), my + .5, mz - sx * sd * (w / 2 - .2), yaw, .4, 1.0, Ls, pitch), 0xb4b5ae); // 壁高欄
      // 橋脚（約 30m ごと。線路・建築限界には置かない）
      acc += L;
      if (acc >= 30 && a.h > 3) {
        const g = gap(a.s, a.l);
        if (g > 4 + w * .4 && !nearLine(a.s - 2, a.s + 2, a.l - 2, a.l + 2) && !inReserved(a.s - 2, a.s + 2, a.l - 2, a.l + 2)) {
          acc = 0;
          const y0 = ground(a.s);
          b.add('body', P.boxB, M(A.x, y0, A.z, yaw, 2.4, a.h - 1.8, 2.4), 0xaeada5);
          b.add('body', P.box, M(A.x, A.y - 2.4, A.z, yaw, w * .85, 1.2, 2.6), 0xaeada5);
        }
      }
    }
  };
  for (const hw of data.highways ?? []) buildHighway(hw[0] as number, hw[1] as number[]);
  // 面（多角形）: s 方向 40m ごとに切って三角形分割し（線路の曲がりに沿わせる）地面に貼る。木を植える面は TreeSpot に
  const AREA_DY: Record<string, number> = { water: .075, lot: .035, grass: .04, pitch: .045, school: .045, park: .05, grave: .055, shrine: .06, wood: .065 };
  const treeAreas: { type: string; pts: number[] }[] = [];
  for (const a of data.areas) {
    const type = a[0] as string, pts = a[1] as number[];
    const col = AREA_COL[type];
    if (!col || pts.length < 6) continue;
    const poly: [number, number][] = [];
    let s0 = Infinity, s1 = -Infinity;
    for (let i = 0; i < pts.length; i += 2) { poly.push([pts[i], pts[i + 1]]); s0 = Math.min(s0, pts[i]); s1 = Math.max(s1, pts[i]); }
    const b = K.chunks.at(pts[0]); b.parent = null;
    const out: number[] = [];
    const dy = AREA_DY[type] ?? .04;
    for (let q = Math.floor(s0 / 40) * 40; q < s1; q += 40) {
      const piece = clipS(clipS(poly, q, 1), q + 40, -1);
      if (piece.length < 3) continue;
      const contour = piece.map(([x, y]) => new THREE.Vector2(x, y));
      const tri = THREE.ShapeUtils.triangulateShape(contour, []);
      const V = contour.map(v => { const p = track.at(v.x, v.y, 0); p.y = lift(v.x) + dy; return p; });
      for (const [i, j, k] of tri) out.push(V[i].x, V[i].y, V[i].z, V[j].x, V[j].y, V[j].z, V[k].x, V[k].y, V[k].z);
    }
    upFacing(out, true);
    if (out.length) b.addTris('road', out, col);
    if (type === 'wood' || type === 'park' || type === 'shrine' || type === 'grave') treeAreas.push({ type, pts });
  }

  // ================= 木 =================
  const spacing: Record<string, number> = { wood: 12, shrine: 13, park: 22, grave: 30 };
  const inPoly = (pts: number[], s: number, l: number) => {
    let c = false;
    for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
      const si = pts[i], li = pts[i + 1], sj = pts[j], lj = pts[j + 1];
      if ((li > l) !== (lj > l) && s < (sj - si) * (l - li) / (lj - li) + si) c = !c;
    }
    return c;
  };
  let nT = 0;
  const TREE_MAX = Math.min(TREE_CAP, Math.round((S1 - S0) / 1000 * TREE_PER_KM));
  const roadNear = buildRoadIndex(data);
  const waters = data.areas.filter(a => a[0] === 'water').map(a => a[1] as number[]);
  const reservedAt = (s: number, l: number) => reserved.some(z => s > z.from && s < z.to && l > z.lat0 && l < z.lat1);
  // 森を先に（浜寺公園の松林など）、次に社寺・公園・墓地
  const order: Record<string, number> = { wood: 0, shrine: 1, park: 2, grave: 3 };
  treeAreas.sort((p, q) => order[p.type] - order[q.type]);
  for (const { type, pts } of treeAreas) {
    let s0 = Infinity, s1 = -Infinity, l0 = Infinity, l1 = -Infinity;
    for (let i = 0; i < pts.length; i += 2) { s0 = Math.min(s0, pts[i]); s1 = Math.max(s1, pts[i]); l0 = Math.min(l0, pts[i + 1]); l1 = Math.max(l1, pts[i + 1]); }
    // 大きな公園（浜寺公園の松林など）は森に近い密度
    const big = type === 'park' && (s1 - s0) * (l1 - l0) > 60000;
    const sp = big ? 14 : spacing[type];
    for (let s = s0 + sp / 2; s < s1; s += sp) for (let l = l0 + sp / 2; l < l1; l += sp) {
      if (nT >= TREE_MAX) break;
      const ss = s + (rnd() - .5) * sp * .8, ll = l + (rnd() - .5) * sp * .8;
      if (!inPoly(pts, ss, ll) || gap(ss, ll) < 6 || roadNear(ss, ll) || reservedAt(ss, ll) || waters.some(w => inPoly(w, ss, ll))) continue;
      if (type === 'park' && rnd() < (big ? .15 : .35)) continue; // 公園は広場を残す
      const [rs, rl] = toReal(ss, ll);
      trees.push({ s: rs, lat: rl, y: ground(ss), k: type === 'wood' || type === 'shrine' || big ? 1.05 + rnd() * .5 : .8 + rnd() * .4 });
      nT++;
    }
  }
  // 道路沿いの街路樹（幹線・主要道路、線路から 40m 以上）
  for (const r of data.roads) {
    if ((r[0] as number) > 1) continue;
    const w = r[1] as number, pts = r[3] as number[];
    for (let i = 0; i + 3 < pts.length && nT < TREE_MAX; i += 2) {
      const s0 = pts[i], l0 = pts[i + 1], s1 = pts[i + 2], l1 = pts[i + 3], L = Math.hypot(s1 - s0, l1 - l0);
      for (let u = 8; u < L; u += 40) {
        const ss = s0 + (s1 - s0) * u / L, ll = l0 + (l1 - l0) * u / L, ns = -(l1 - l0) / L, nl = (s1 - s0) / L;
        for (const side of [-1, 1]) {
          const ts = ss + ns * side * (w / 2 + 1.2), tl = ll + nl * side * (w / 2 + 1.2);
          if (gap(ts, tl) < 40 || rnd() < .3) continue;
          const [rs, rl] = toReal(ts, tl);
          trees.push({ s: rs, lat: rl, y: ground(ts), k: .7 + rnd() * .25 }); nT++;
        }
      }
    }
  }
  if (import.meta.env?.DEV) console.info(`OSM 景観: 建物 ${nB}（補い ${filler.length} 候補）、道路 ${nR}、木 ${nT}/${TREE_MAX}`);
  return { roadCount: nR, buildings: nB };
}

/** 三角形の向きを上向きにそろえる */
function upFacing(t: number[], each = false) {
  for (let i = 0; i + 8 < t.length; i += 9) {
    const ux = t[i + 3] - t[i], uz = t[i + 5] - t[i + 2], vx = t[i + 6] - t[i], vz = t[i + 8] - t[i + 2];
    if (uz * vx - ux * vz < 0) for (let k = 0; k < 3; k++) { const x = t[i + 3 + k]; t[i + 3 + k] = t[i + 6 + k]; t[i + 6 + k] = x; }
    if (!each) continue;
  }
}

/** s-lat の折れ線を横へずらす */
function offsetLine(pts: number[], off: number): number[] {
  const out: number[] = [];
  const n = pts.length / 2;
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    const ds = pts[b * 2] - pts[a * 2], dl = pts[b * 2 + 1] - pts[a * 2 + 1], L = Math.hypot(ds, dl) || 1;
    out.push(pts[i * 2] - dl / L * off, pts[i * 2 + 1] + ds / L * off);
  }
  return out;
}

/** 木を道路の上に植えないための簡易索引（10m 格子） */
function buildRoadIndex(data: OsmData): (s: number, l: number) => boolean {
  const cells = new Set<string>();
  for (const r of data.roads) {
    const w = r[1] as number, pts = r[3] as number[];
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const L = Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]);
      for (let u = 0; u <= L; u += 4) {
        const s = pts[i] + (pts[i + 2] - pts[i]) * u / (L || 1), l = pts[i + 1] + (pts[i + 3] - pts[i + 1]) * u / (L || 1);
        for (let dl = -w / 2; dl <= w / 2; dl += 4) cells.add(`${Math.floor(s / 4)},${Math.floor((l + dl) / 4)}`);
      }
    }
  }
  return (s, l) => cells.has(`${Math.floor(s / 4)},${Math.floor(l / 4)}`);
}
