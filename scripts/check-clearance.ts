// 構造物の建築限界チェック（描画なし）。esbuild で Node 向けに束ねて実行する。
// 南海本線（下り・上り × 普通/急行/特急）と高野線（下り・上り）のワールドを列車なしで組み立て、
// src/debug/clearance.ts で全メッシュを走行線の建築限界に対して標本判定する。読込素材（ビル・木）は簡易モデルで代替。
//   npm run verify:clearance            違反があれば終了コード 1
//   npm run verify:clearance -- --all   全違反群を表示
//   npm run verify:clearance -- --route=shiokaze --service=local   1ケースだけ点検
import * as THREE from 'three';
import { shiokaze, shiokazeUp } from '../src/route/routes/shiokaze';
import { mountain, mountainUp } from '../src/route/routes/mountain';
import { kishiwada, kishiwadaUp } from '../src/route/routes/kishiwada';
import { through, throughUp } from '../src/route/routes/through';
import { buildTrack } from '../src/route/track';
import { applyService } from '../src/route/service';
import type { Route, ServiceId } from '../src/route/types';
import { createState } from '../src/game/state';
import { EventBus } from '../src/core/events';
import { createTrainEnv } from '../src/sim/train';
import { createRng } from '../src/core/rng';
import type { GameContext } from '../src/core/context';
import { buildTerrain } from '../src/world/terrain';
import { buildTrackMesh } from '../src/world/track-mesh';
import { buildStructures } from '../src/world/structures';
import { buildCoastalLandmarks } from '../src/world/coastal-landmarks';
import { buildCatenary } from '../src/world/catenary';
import { buildBackdrop, buildEndBlock, placeScenery, prepareSceneryModels } from '../src/world/scenery';
import { buildSigns } from '../src/world/signs';
import { buildStations } from '../src/world/stations';
import { buildTown } from '../src/world/town-jp';
import { buildSignals } from '../src/world/signals';
import { buildCrossings } from '../src/world/crossings';
import type { OncomingSystem } from '../src/world/oncoming';
import { checkClearance } from '../src/debug/clearance';

// --- DOM の最小スタブ（canvas は描画命令を捨てる） ---
const sink: any = new Proxy(function () { /* noop */ }, {
  get: (_t, k) => k === Symbol.toPrimitive ? () => 0 : k === 'width' || k === 'height' ? 0 : k === 'data' ? new Uint8ClampedArray(4) : sink,
  set: () => true,
  apply: () => sink,
});
const canvas = () => ({ width: 0, height: 0, style: {}, getContext: () => sink, toDataURL: () => '' });
(globalThis as any).window = {};
(globalThis as any).document = { createElement: () => canvas(), getElementById: () => null, head: sink, body: sink };
(globalThis as any).localStorage = { getItem: () => null, setItem() { /* */ }, removeItem() { /* */ } };

function context(source: Route): GameContext {
  const route = structuredClone(source);
  return {
    route, track: buildTrack(route), events: new EventBus(), state: createState(route, { stageId: 'all', service: 'local', mode: 'normal', vehicles: {} } as any),
    trainEnv: createTrainEnv(), scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), renderer: null!, env: null!, rng: createRng(12345),
    assetsReady: true, envState: { timeOfDay: 'noon', weather: 'clear', intensity: 0 }, light: { night: 0, tunnel: 0 }, cameraMode: 'cab', actions: null!,
  };
}

const fakeOncoming = { activeSpans: () => [] } as unknown as OncomingSystem;
function build(ctx: GameContext): void {
  buildTerrain(ctx);
  buildTrackMesh(ctx);
  buildStructures(ctx);
  buildCoastalLandmarks(ctx);
  buildCatenary(ctx);
  buildBackdrop(ctx);
  buildSigns(ctx);
  buildStations(ctx);
  buildEndBlock(ctx);
  const town = buildTown(ctx);
  buildSignals(ctx);
  buildCrossings(ctx, fakeOncoming);
  placeScenery(ctx, prepareSceneryModels({} as any), town.trees);
}

const all = process.argv.includes('--all');
const option = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
const routeFilter = option('route'), serviceFilter = option('service');
const cases: [Route, ServiceId[]][] = [[shiokaze, ['local', 'express', 'airport', 'limited']], [shiokazeUp, ['local', 'express', 'airport', 'limited']], [mountain, ['local']], [mountainUp, ['local']],
  [kishiwada, ['local', 'express', 'airport', 'southern']], [kishiwadaUp, ['local', 'express', 'airport', 'southern']],
  [throughUp, ['local', 'airport', 'southern']], [through, ['local', 'airport', 'southern']]];
let total = 0;
let checked = 0;
for (const [src, services] of cases) {
  for (const svc of services) {
    if (routeFilter && src.id !== routeFilter || serviceFilter && svc !== serviceFilter) continue;
    checked++;
    console.log(`検査開始 ${src.id} ${svc}`);
    const ctx = context(src);
    ctx.service = applyService(ctx.route, svc);
    let tb = Date.now(); build(ctx); if (process.env.CLR_DEBUG) console.error('build', Date.now() - tb, 'ms');
    const r = await checkClearance(ctx, { log: process.env.CLR_DEBUG ? m => console.error(m) : undefined });
    const hits = r.hits;
    total += hits.length;
    console.log(`${ctx.route.id} ${svc}: 違反 ${hits.length} 群（三角形 ${r.tris}、標本 ${r.points}、${r.ms}ms）`);
    for (const h of hits.slice(0, all ? Infinity : 60)) console.log(`  s ${h.s0}..${h.s1} ${h.line} 最小離隔 ${h.minD}m 高さ ${h.h0}..${h.h1}m ×${h.n} ${h.obj} ${h.color}`);
  }
}
if (!checked) throw new Error('検査対象なし。--route / --service を確認');
if (total) { console.log(`建築限界の違反 ${total} 群`); process.exit(1); }
console.log('建築限界の違反なし');
