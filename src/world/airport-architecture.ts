// 南海空港線の駅前建築。駅の platform 範囲を基準にするため、concatRoutes 後も位置がずれない。
// 寸法は公式資料と現地の外形をもとにしたゲーム用の概形であり、広告・看板は置かない。
import * as THREE from 'three';
import type { GameContext } from '../core/context';
import type { Route } from '../route/types';
import { airport } from '../route/routes/airport';
import { sectionFrame } from './section-frame';
import { GeoBatch, M, P } from './batch';
import { cullByDistance } from './cull';
import { getTerrain } from './terrain';

const C = {
  concrete: 0xb8bdc0, dark: 0x4e5b63, steel: 0x78848a,
  silver: 0xb8c0c4, glass: 0x54808b, glassDark: 0x294853,
  deck: 0x909a9d, road: 0x3d464a, hotel: 0xb0a8a0,
  hotelStep: 0x777f82, tower: 0x9ca8ad, towerDark: 0x415b66,
  light: 0xe9c77d,
};

type Site = { s: number; side: 1 | -1; ground: number; yaw: number };

/** stopS は concatRoutes と方向反転で変わるため、駅ホームの共有座標だけを読む。 */
function site(ctx: GameContext, name: string): Site | undefined {
  const st = ctx.route.stations.find(x => x.name === name);
  if (!st?.platform) return undefined;
  const s = (st.platform.from + st.platform.to) / 2;
  const t = ctx.track.trackAt(s), side = ctx.route.id.endsWith('-up') ? -1 : 1;
  const ground = getTerrain(ctx).groundY(s) + getTerrain(ctx).reliefY(s, 0);
  return { s, side, ground, yaw: -t.phi };
}

function world(ctx: GameContext, s: number, lat: number, y: number): THREE.Vector3 {
  const t = ctx.track.trackAt(s);
  return ctx.track.at(s, lat, y - t.y);
}

function box(b: GeoBatch, key: string, p: THREE.Vector3, yaw: number, w: number, h: number, d: number, color: number): void {
  b.add(key, P.box, M(p.x, p.y, p.z, yaw, w, h, d), color);
}

function groundBox(ctx: GameContext, b: GeoBatch, key: string, s: number, lat: number, w: number, h: number, d: number, color: number, y = 0, yaw = 0): void {
  const p = world(ctx, s, lat, getTerrain(ctx).groundY(s) + y + h / 2);
  box(b, key, p, -ctx.track.trackAt(s).phi + yaw, w, h, d, color);
}

function column(b: GeoBatch, p: THREE.Vector3, yaw: number, w: number, h: number, d: number, color = C.concrete): void {
  b.add('body', P.boxB, M(p.x, p.y, p.z, yaw, w, h, d), color);
}

function buildRinkuTower(ctx: GameContext, b: GeoBatch, st: Site): void {
  const side = st.side, s = st.s;
  // りんくうゲートタワー: 256m・56階。低い podium から細い塔へ段階的に立ち上げる。
  groundBox(ctx, b, 'body', s + 14, side * 58, 66, 16, 18, C.concrete);
  groundBox(ctx, b, 'glass', s + 14, side * 48.7, 63, 8, 2, C.glassDark, 8.5);
  const towerW = 35, towerD = 28, floorH = 4.55, towerH = 56 * floorH;
  const center = world(ctx, s + 14, side * 62, st.ground + towerH / 2);
  box(b, 'body', center, st.yaw, towerW, towerH, towerD, C.tower);
  // 縦フィンは遠景でも塔の輪郭を残し、窓帯は階層を読み取れる密度にする。
  for (const lat of [-towerW / 2 - .35, towerW / 2 + .35]) {
    const p = world(ctx, s + 14, side * 62 + lat, st.ground + towerH / 2);
    box(b, 'steel', p, st.yaw, .7, towerH + 1, towerD + 1.2, C.steel);
  }
  // 塔の両側面をガラスカーテンウォールにし、階ごとのスパンドレルを外皮へ出す。
  for (const face of [-1, 1]) {
    const lat = side * 62 + face * towerW / 2;
    const p = world(ctx, s + 14, lat, st.ground + towerH / 2);
    box(b, 'glass', p, st.yaw, .24, towerH - 1, towerD - .8, C.glass);
    for (let floor = 1; floor < 56; floor++) {
      const q = world(ctx, s + 14, lat + face * .16, st.ground + floor * floorH);
      box(b, 'steel', q, st.yaw, .34, .18, towerD + .4, C.steel);
    }
  }
  for (let floor = 1; floor < 56; floor += 2) {
    const y = st.ground + floor * floorH;
    const p = world(ctx, s + 14, side * 62, y);
    box(b, 'glass', p, st.yaw, towerW + .12, .28, towerD + .2, floor % 4 === 1 ? C.glassDark : C.glass);
  }
  for (let i = -2; i <= 2; i++) {
    const p = world(ctx, s + 14, side * (62 + i * 6.7), st.ground + towerH / 2);
    box(b, 'steel', p, st.yaw, .24, towerH + .4, 1.05, C.steel);
  }
  // 駅前広場側の低い入口ボリューム。塔を地面から浮かせない。
  groundBox(ctx, b, 'body', s - 4, side * 42, 38, 8, 30, C.concrete);
  groundBox(ctx, b, 'glass', s - 4, side * 41.4, 28, 4.2, .3, C.glass, 6.2);
  for (let i = -2; i <= 2; i++) groundBox(ctx, b, 'steel', s - 4 + i * 7, side * 41.1, .18, 6.6, .4, C.steel);
}

function buildRinkuDeck(ctx: GameContext, b: GeoBatch, st: Site): void {
  const side = st.side, s = st.s;
  const p = world(ctx, s, 0, ctx.track.trackAt(s).y + 10.8);
  const deckBottom = ctx.track.trackAt(s).y + 10.2;
  const pierHeight = Math.max(1, deckBottom - st.ground);
  // 駅の上を横切る橋上デッキ。床下面をレール面から10m以上離し、架線を塞がない。
  box(b, 'deck', p, st.yaw, 92, 1.2, 18, C.deck);
  for (const lat of [-39, -25, 25, 39]) {
    const q = world(ctx, s, lat, st.ground);
    column(b, q, st.yaw, 1.4, pierHeight, 1.4, C.concrete);
  }
  for (const lat of [-42, 42]) {
    const q = world(ctx, s, lat, st.ground + 11.5);
    box(b, 'glass', q, st.yaw, 1.1, 2.8, 18, C.glass);
  }
  // 塔側と駅前側の連絡リンク。線路上に柱を増やさず、外側の地面へ下ろす。
  for (const lat of [side * 30, side * 58]) {
    const q = world(ctx, s, lat, st.ground + 7.2);
    box(b, 'deck', q, st.yaw, 12, .9, 7, C.deck);
  }
  // 塔の足元から駅前道路へ続く広場と、線路に平行なアクセス道路。
  groundBox(ctx, b, 'deck', s + 18, side * 33, 34, .22, 66, C.deck, .1);
  groundBox(ctx, b, 'body', s - 2, side * 22, 12, .18, 150, C.road, .22);
}

function buildKixTerminal(ctx: GameContext, b: GeoBatch, st: Site): void {
  const side = st.side, s = st.s;
  // T1 は列車から見て左、Aeroplaza・ホテル側は右。前面のガラスと銀色の屋根を分節する。
  const roofStart = s - 245, roofEnd = s + 95, step = 24;
  for (let q = roofStart; q < roofEnd; q += step) {
    const mid = Math.min(q + step / 2, roofEnd);
    const span = Math.min(step + .6, roofEnd - q + .6);
    const rise = .55 * Math.sin((mid - roofStart) / (roofEnd - roofStart) * Math.PI);
    // 断面を横方向に丸めて押し出す。平板を重ねず、各パネルの上下面を閉じる。
    const cross = 8, roofHalf = 15;
    for (let j = 0; j < cross; j++) {
      const x0 = -roofHalf + roofHalf * 2 * j / cross, x1 = -roofHalf + roofHalf * 2 * (j + 1) / cross;
      const y0 = 17 + rise + 1.35 * (1 - (x0 / roofHalf) ** 2), y1 = 17 + rise + 1.35 * (1 - (x1 / roofHalf) ** 2);
      const a = world(ctx, q, -side * (31 + x0), st.ground + y0), z = world(ctx, q + span, -side * (31 + x0), st.ground + y0);
      const c = world(ctx, q, -side * (31 + x1), st.ground + y1), d = world(ctx, q + span, -side * (31 + x1), st.ground + y1);
      const ab = world(ctx, q, -side * (31 + x0), st.ground + 16.7), zb = world(ctx, q + span, -side * (31 + x0), st.ground + 16.7);
      const cb = world(ctx, q, -side * (31 + x1), st.ground + 16.7), db = world(ctx, q + span, -side * (31 + x1), st.ground + 16.7);
      b.addTris('roof', [a.x, a.y, a.z, z.x, z.y, z.z, d.x, d.y, d.z, a.x, a.y, a.z, d.x, d.y, d.z, c.x, c.y, c.z], C.silver);
      b.addTris('roof', [ab.x, ab.y, ab.z, cb.x, cb.y, cb.z, db.x, db.y, db.z, ab.x, ab.y, ab.z, db.x, db.y, db.z, zb.x, zb.y, zb.z], C.steel);
      b.addTris('roof', [a.x, a.y, a.z, ab.x, ab.y, ab.z, zb.x, zb.y, zb.z, a.x, a.y, a.z, zb.x, zb.y, zb.z, z.x, z.y, z.z], C.steel);
    }
    groundBox(ctx, b, 'body', mid, -side * 30, 28, 17, span - 1, C.concrete);
    groundBox(ctx, b, 'glass', mid, -side * 45, .28, 16, 27, C.glass, .6);
    for (const ds of [-8, 0, 8]) groundBox(ctx, b, 'steel', mid + ds, -side * 45.2, .45, 15.8, .18, C.steel, .7);
  }
  // 進入側の正面エンドキャップ。ガラス、サッシ、柱、軒を一体で閉じる。
  const cap = roofStart - 1;
  groundBox(ctx, b, 'glass', cap, -side * 30, 28, 16, .35, C.glass, .6);
  for (let i = -3; i <= 3; i++) groundBox(ctx, b, 'steel', cap, -side * (30 + i * 4), .28, 16.4, .35, C.steel, .4);
  groundBox(ctx, b, 'steel', cap, -side * 30, 30, .55, .8, C.steel, 16.6);
  // 右側の Aeroplaza / ホテルは段状にし、単純な直方体に見せない。
  const hotelS = s - 110, hotelLat = side * 68;
  groundBox(ctx, b, 'body', hotelS, hotelLat, 48, 14, 58, C.hotel);
  for (let level = 0; level < 3; level++) {
    const q = world(ctx, hotelS + level * 16, hotelLat, st.ground + 14 + level * 4.8);
    box(b, 'hotel', q, st.yaw, 44 - level * 5, 4.2, 47 - level * 4, level === 2 ? C.hotelStep : C.hotel);
  }
  for (const lat of [hotelLat - side * 24, hotelLat + side * 24]) {
    for (let i = -2; i <= 2; i++) groundBox(ctx, b, 'glass', hotelS + i * 14, lat, 6, 4.8, .35, C.glassDark, 7);
  }
  // 空港アクセスの多層駐車場。開いたデッキと柱の間から背景が見える。
  const parkLat = side * 96, parkS = s - 35;
  for (let floor = 0; floor < 4; floor++) {
    const y = floor * 3.8;
    groundBox(ctx, b, 'deck', parkS, parkLat, 43, .55, 96, C.deck, y);
    for (let i = -3; i <= 3; i++) groundBox(ctx, b, 'steel', parkS + i * 14, parkLat - side * 19, .8, 3.6, .8, C.steel, y);
    for (let i = -3; i <= 3; i++) groundBox(ctx, b, 'steel', parkS + i * 14, parkLat + side * 19, .8, 3.6, .8, C.steel, y);
  }
  groundBox(ctx, b, 'deck', parkS, parkLat, 43, .6, 96, C.deck, 15.2);
  for (const lat of [parkLat - side * 19, parkLat + side * 19]) {
    for (const ds of [-38, 38]) groundBox(ctx, b, 'steel', parkS + ds, lat, .8, 15.8, .8, C.steel);
  }
  // 650m のアクセス帯を小区画に分け、単色の地面を歩道・車道・駐車区画で割る。
  for (let ds = -320; ds <= 300; ds += 40) {
    const q = s + ds;
    groundBox(ctx, b, 'body', q, side * 38, 12, .18, 36, C.road, .22);
    groundBox(ctx, b, 'deck', q, side * 30, 2.2, .12, 36, C.concrete, .18);
    groundBox(ctx, b, 'deck', q, side * 50, 2.2, .12, 36, C.concrete, .18);
    groundBox(ctx, b, 'deck', q, parkLat, 43, .1, 36, ds % 80 ? C.deck : C.concrete, .16);
    for (let lane = -3; lane <= 3; lane++) groundBox(ctx, b, 'steel', q + lane * 4, parkLat, .08, .025, 5, C.steel, .25);
  }
}

function addSite(ctx: GameContext, b: GeoBatch, name: string): boolean {
  const st = site(ctx, name);
  if (!st) return false;
  if (name === 'りんくうタウン') { buildRinkuTower(ctx, b, st); buildRinkuDeck(ctx, b, st); }
  if (name === '関西空港') buildKixTerminal(ctx, b, st);
  return true;
}

function materials(): Record<string, THREE.Material> {
  return {
    body: new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }),
    glass: new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, transparent: true, opacity: .72, depthWrite: false, side: THREE.DoubleSide }),
    glassDark: new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, transparent: true, opacity: .8, depthWrite: false, side: THREE.DoubleSide }),
    steel: new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }),
    roof: new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }),
    deck: new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }),
    hotel: new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }),
    hotelStep: new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }),
  };
}

/** 空港線の駅前建築を配置する。駅名が無い共有コースでは何も追加しない。 */
export function buildAirportArchitecture(ctx: GameContext): void {
  if (ctx.route.lineId !== 'airport' && !ctx.route.id.startsWith('airport')) return;
  for (const name of ['りんくうタウン', '関西空港']) {
    const group = new THREE.Group(); group.name = `airport-architecture-${name}`;
    const batch = new GeoBatch();
    if (!addSite(ctx, batch, name)) continue;
    const meshes = batch.build(materials(), group);
    if (!meshes.length) continue;
    ctx.scene.add(group);
    cullByDistance(ctx, group, 1900);
  }
}

/** OSM の建物・木・駐車場を専用施設の敷地から除く。stopS ではなく platform の共有座標を使う。 */
export function airportArchitectureReservations(route: Route): NonNullable<Route['reserved']> {
  const out: NonNullable<Route['reserved']> = [];
  const source = route.id === 'airport-namba-up' ? airport : route;
  const frame = source === route ? null : sectionFrame(source, route);
  for (const name of ['りんくうタウン', '関西空港']) {
    const st = source.stations.find(x => x.name === name);
    if (!st?.platform) continue;
    const center = (st.platform.from + st.platform.to) / 2;
    const side = source.id.endsWith('-up') ? -1 : 1;
    const spec = name === 'りんくうタウン'
      ? { from: center - 55, to: center + 65, lat0: side * 28 - 42, lat1: side * 28 + 110, keepRoads: true }
      : { from: center - 340, to: center + 300, lat0: side * 18 - 118, lat1: side * 18 + 118, keepRoads: true, noPiers: true };
    if (!frame) out.push(spec);
    else out.push({ ...spec, from: Math.min(frame.mapS(spec.from), frame.mapS(spec.to)), to: Math.max(frame.mapS(spec.from), frame.mapS(spec.to)), lat0: Math.min(frame.mapL(spec.lat0), frame.mapL(spec.lat1)), lat1: Math.max(frame.mapL(spec.lat0), frame.mapL(spec.lat1)) });
  }
  return out;
}
