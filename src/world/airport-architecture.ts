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
import { buildRinkuLandmarks } from './rinku-landmarks';

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

/** 階段をホームの中央に収める。 */
function stairs(ctx: GameContext, b: GeoBatch, s: number, lat: number, bottom: number, top: number): void {
  const steps = Math.ceil((top - bottom) / .19);
  for (let i = 1; i <= steps; i++) {
    const y = bottom + (top - bottom) * i / steps;
    const q = s + .29 * (i - steps / 2);
    box(b, 'deck', world(ctx, q, lat, y - .18), -ctx.track.trackAt(q).phi, 1.9, .36, .31, C.concrete);
  }
}

function buildRinkuDeck(ctx: GameContext, b: GeoBatch, st: Site): void {
  const s = st.s, rail = ctx.track.trackAt(s).y, floor = rail - 4.8;
  // 3階ホームの下に共用改札を置き、2階の自由通路で駅の両側を結ぶ。
  box(b, 'deck', world(ctx, s, 6, floor - .3), st.yaw, 82, .6, 24, C.deck);
  for (const lat of [-29, -16, 20, 39]) for (const ds of [-10, 10])
    column(b, world(ctx, s + ds, lat, st.ground), st.yaw, 1, floor - st.ground, 1);
  for (const lat of [-4.6, 8.6]) stairs(ctx, b, s - 5, lat, floor, rail + 1.1);
  for (const lat of [-32, 32]) for (const ds of [-12, 12])
    box(b, 'glass', world(ctx, s + ds, lat, floor + 1.2), st.yaw, 14, 2.4, .2, C.glass);
  stairs(ctx, b, s - 17, -30, st.ground + .1, floor);
}

function buildKixTerminal(ctx: GameContext, b: GeoBatch, st: Site): void {
  const side = st.side, s = st.s, rail = ctx.track.trackAt(s).y, floor = rail + 7.8;
  // 2階の自由通路が線路を横断する。両ホームの階段が床とガラス壁を抜ける部分を開ける。
  const spans = [[-85, -1.85], [.65, 13.35], [15.85, 105]];
  for (const [left, right] of spans) {
    const middle = (left + right) / 2;
    box(b, 'deck', world(ctx, s - 6, middle, floor - .4), st.yaw, right - left, .8, 4, C.deck);
    box(b, 'glass', world(ctx, s - 8, middle, floor + 1.4), st.yaw, right - left, 2.8, .25, C.glass);
  }
  box(b, 'deck', world(ctx, s + 2, 10, floor - .4), st.yaw, 190, .8, 12, C.deck);
  for (const lat of [-61, -27, 27, 60, 95]) for (const ds of [-6, 6])
    column(b, world(ctx, s + ds, lat, st.ground), st.yaw, 1.2, floor - st.ground, 1.2);
  box(b, 'glass', world(ctx, s + 8, 10, floor + 1.4), st.yaw, 190, 2.8, .25, C.glass);
  box(b, 'roof', world(ctx, s, 10, floor + 3.3), st.yaw, 190, .45, 17, C.silver);
  for (const lat of [-.6, 14.6]) stairs(ctx, b, s - 9, lat, rail + 1.1, floor);
  // T1 は列車から見て左、Aeroplaza・ホテル側は右。前面のガラスと銀色の屋根を分節する。
  const roofStart = s - 245, roofEnd = s + 95, step = 24;
  for (let q = roofStart; q < roofEnd; q += step) {
    const mid = Math.min(q + step / 2, roofEnd);
    const span = Math.min(step + .6, roofEnd - q + .6);
    const rise = .55 * Math.sin((mid - roofStart) / (roofEnd - roofStart) * Math.PI);
    // 断面を横方向に丸めて押し出す。平板を重ねず、各パネルの上下面を閉じる。
    const cross = 8, roofHalf = 32;
    for (let j = 0; j < cross; j++) {
      const x0 = -roofHalf + roofHalf * 2 * j / cross, x1 = -roofHalf + roofHalf * 2 * (j + 1) / cross;
      const y0 = 17 + rise + 1.35 * (1 - (x0 / roofHalf) ** 2), y1 = 17 + rise + 1.35 * (1 - (x1 / roofHalf) ** 2);
      const a = world(ctx, q, -side * (105 + x0), st.ground + y0), z = world(ctx, q + span, -side * (105 + x0), st.ground + y0);
      const c = world(ctx, q, -side * (105 + x1), st.ground + y1), d = world(ctx, q + span, -side * (105 + x1), st.ground + y1);
      const ab = world(ctx, q, -side * (105 + x0), st.ground + 16.7), zb = world(ctx, q + span, -side * (105 + x0), st.ground + 16.7);
      const cb = world(ctx, q, -side * (105 + x1), st.ground + 16.7), db = world(ctx, q + span, -side * (105 + x1), st.ground + 16.7);
      b.addTris('roof', [a.x, a.y, a.z, z.x, z.y, z.z, d.x, d.y, d.z, a.x, a.y, a.z, d.x, d.y, d.z, c.x, c.y, c.z], C.silver);
      b.addTris('roof', [ab.x, ab.y, ab.z, cb.x, cb.y, cb.z, db.x, db.y, db.z, ab.x, ab.y, ab.z, db.x, db.y, db.z, zb.x, zb.y, zb.z], C.steel);
      b.addTris('roof', [a.x, a.y, a.z, ab.x, ab.y, ab.z, zb.x, zb.y, zb.z, a.x, a.y, a.z, zb.x, zb.y, zb.z, z.x, z.y, z.z], C.steel);
    }
    groundBox(ctx, b, 'body', mid, -side * 105, 63, 17, span - 1, C.concrete);
    groundBox(ctx, b, 'glass', mid, -side * 72.9, .28, 16, span - 1, C.glass, .6);
    for (const ds of [-8, 0, 8]) groundBox(ctx, b, 'steel', mid + ds, -side * 72.8, .45, 15.8, .18, C.steel, .7);
  }
  // 進入側の正面エンドキャップ。ガラス、サッシ、柱、軒を一体で閉じる。
  const cap = roofStart - 1;
  groundBox(ctx, b, 'glass', cap, -side * 105, 63, 16, .35, C.glass, .6);
  for (let i = -3; i <= 3; i++) groundBox(ctx, b, 'steel', cap, -side * (105 + i * 9), .28, 16.4, .35, C.steel, .4);
  groundBox(ctx, b, 'steel', cap, -side * 105, 65, .55, .8, C.steel, 16.6);
  // 右側の Aeroplaza / ホテルは段状にし、単純な直方体に見せない。
  const hotelS = s, hotelLat = side * 119;
  groundBox(ctx, b, 'body', hotelS, hotelLat, 48, 14, 58, C.hotel);
  for (let level = 0; level < 3; level++) {
    const q = world(ctx, hotelS + level * 16, hotelLat, st.ground + 14 + level * 4.8);
    box(b, 'hotel', q, st.yaw, 44 - level * 5, 4.2, 47 - level * 4, level === 2 ? C.hotelStep : C.hotel);
  }
  for (const lat of [hotelLat - side * 24, hotelLat + side * 24]) {
    for (let i = -2; i <= 2; i++) groundBox(ctx, b, 'glass', hotelS + i * 14, lat, 6, 4.8, .35, C.glassDark, 7);
  }
  // 空港アクセスの多層駐車場。開いたデッキと柱の間から背景が見える。
  const parkLat = -side * 46, parkS = s - 126;
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

}

function addSite(ctx: GameContext, b: GeoBatch, name: string): boolean {
  const st = site(ctx, name);
  if (!st) return false;
  if (name === 'りんくうタウン') {
    buildRinkuTower(ctx, b, st); buildRinkuDeck(ctx, b, st);
    const group = new THREE.Group(); group.name = 'airport-rinku-landmarks';
    buildRinkuLandmarks(ctx, st.s, group);
    if (group.children.length) ctx.scene.add(group);
  }
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
  const source = route.airportBridge?.islandAtStart ? airport : route;
  const frame = source === route ? null : sectionFrame(source, route);
  for (const name of ['りんくうタウン', '関西空港']) {
    const st = source.stations.find(x => x.name === name);
    if (!st?.platform) continue;
    const center = (st.platform.from + st.platform.to) / 2;
    // 個々の棟と内海だけを予約し、棟間の道路や駅前広場は残す。
    const footprints = name === 'りんくうタウン'
      ? [[-22,76,30,83], [-19,49,-315,-94], [8,156,-437,-373], [25,90,-376,-312],
         [404,548,-365,-178]]
      : [[-247,100,-138,-72], [-176,-76,-68,-24], [-31,55,94,145], [-950,132,-18,27]];
    for (const [from,to,l0,l1] of footprints) {
      const s0 = center + from, s1 = center + to;
      const a = frame ? frame.mapS(s0) : s0, b = frame ? frame.mapS(s1) : s1;
      const l = frame ? frame.mapL(l0) : l0, r = frame ? frame.mapL(l1) : l1;
      out.push({from: Math.min(a,b), to: Math.max(a,b), lat0: Math.min(l,r), lat1: Math.max(l,r)});
    }
  }
  return out;
}
