// 追加車両の選択・保存復元・方向別併結と既存運行の回帰検証。
// node_modules/.bin/esbuild scripts/verify-playable-trains.ts --bundle --platform=node --format=esm --external:three --outfile=node_modules/.cache/verify-playable-trains.mjs
import { applyRealDiagram } from '../src/route/real-diagram';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { shiokaze, shiokazeUp } from '../src/route/routes/shiokaze';
import { kishiwada, kishiwadaUp } from '../src/route/routes/kishiwada';
import { through, throughUp } from '../src/route/routes/through';
import { namba, nambaUp } from '../src/route/routes/namba';
import { mountain, mountainUp } from '../src/route/routes/mountain';
import { applyVehicles, applyService, serviceOf } from '../src/route/service';
import { playerVehicleOptions } from '../src/route/player-vehicles';
import { createState, resetState, type VehicleSel } from '../src/game/state';
import { createGame } from '../src/game/loop';
import { buildTrack } from '../src/route/track';
import { EventBus } from '../src/core/events';
import { createTrainEnv, TRAIN_PERF } from '../src/sim/train';
import { createRng } from '../src/core/rng';
import { front7169ForRoute } from '../src/route/vehicle-direction';
import { pantographPositions } from '../src/world/trains/pantograph-layout';
import type { Route, ServiceId, TrainKind } from '../src/route/types';
import type { GameContext } from '../src/core/context';

const memory = new Map<string, string>();
(globalThis as any).window = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => memory.set(k, v),
  removeItem: (k: string) => memory.delete(k),
};
function context(source: Route, service: ServiceId, vehicles: VehicleSel = {}): GameContext {
  const route = structuredClone(source);
  return {
    route, track: buildTrack(route), events: new EventBus(),
    state: createState(route, { stageId: 'all', service, mode: 'normal', vehicles }),
    trainEnv: createTrainEnv(), scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(),
    renderer: null!, env: null!, rng: createRng(12345), assetsReady: true,
    envState: { timeOfDay: 'noon', weather: 'clear', intensity: 0 }, light: { night: 0, tunnel: 0 },
    cameraMode: 'cab', actions: null!,
  };
}
function operation(route: Route) {
  return {
    stations: route.stations, limits: route.limits, trainLength: route.trainLength,
    startS: route.startS, lineLimit: route.lineLimit, activeLane: route.activeLane,
  };
}
let cases = 0;
// 車体が反転する最後尾を含め、難波方から見た実装上の配置を検査する。
const roofCases: [TrainKind, string][] = [
  ['commuter-old', 'N--N'], ['commuter-old', 'N-'], ['commuter-7100-restored', 'N--N'],
  ['commuter-new', 'S--N'], ['commuter-new', '-B'], ['commuter-6300', 'N-N--N'],
  ['commuter-6300', 'N--N'], ['commuter-6300', 'N-'], ['commuter-1000', 'B-B---'],
  ['commuter-2000', 'B-'], ['commuter-2000', 'B---'], ['commuter-2300', 'SS'],
  ['commuter-9000', '-B--'], ['commuter-9000', '-B-B--'], ['southern-10000', 'B-B-'],
  ['southern-12000', 'S--N'], ['limited-30000', 'B-B-'], ['limited', '-B--B-'],
];
for (const [kind, layout] of roofCases) for (const nambaFirst of [true, false]) {
  const observed = Array.from(layout, (_, nambaIndex) => {
    const i = nambaFirst ? nambaIndex : layout.length - nambaIndex - 1;
    const z = pantographPositions(kind, layout.length, i, nambaFirst, 19.5);
    const ends = z.map(p => p * (i === layout.length - 1 ? -1 : 1) * (nambaFirst ? 1 : -1));
    if (ends.length === 2) { assert.ok(ends[0] * ends[1] < 0); return 'B'; }
    return !ends.length ? '-' : ends[0] < 0 ? 'N' : 'S';
  }).join('');
  assert.equal(observed, layout, kind);
  cases++;
}
assert.equal(front7169ForRoute('shiokaze'), true, '泉大津→堺は難波方7169が先頭');
assert.equal(front7169ForRoute('shiokaze-up'), false, '堺→泉大津は和歌山市方7170が先頭');
assert.equal(front7169ForRoute('nankai-through'), true, '岸和田→堺は難波方7169が先頭');
assert.equal(front7169ForRoute('nankai-through-up'), false, '堺→岸和田は和歌山市方7170が先頭');
cases += 4;
const coastal = [shiokaze, shiokazeUp, kishiwada, kishiwadaUp, through, throughUp, namba, nambaUp];
for (const source of [...coastal, mountain, mountainUp]) {
  for (const spec of source.services ?? []) {
    // 追加前からの適用手順と既定車両の線路・停止位置・時刻を比較する。
    const baseline = structuredClone(source);
    const current = context(source, spec.id);
    if (current.state.sel.service !== spec.id) continue; // この時間帯（既定は日中）に実際に走らない種別（実ダイヤ）は選べない
    applyVehicles(baseline, {}); applyService(baseline, spec.id);
    applyRealDiagram(baseline, spec.id, current.state.fromIndex, current.state.endIndex); // 時刻・開始時刻は実ダイヤの列車に合わせる
    assert.deepEqual(operation(current.route), operation(baseline), `${source.id}/${spec.id} 既定運行`);
    assert.equal(serviceOf(current.route, spec.id)!.kind, spec.kind);
    assert.deepEqual(serviceOf(current.route, spec.id)!.units, spec.units);
    cases++;
  }
}
for (const source of coastal) {
  for (const id of ['local', 'express', 'airport'] as const) {
    if (!source.services?.some(s => s.id === id)) continue;
    const c = context(source, id, { [id]: { kind: 'commuter-1000', units: [4, 2] } });
    if (c.state.sel.service !== id) continue; // 日中に実際に走らない種別（実ダイヤ）
    assert.equal(serviceOf(c.route, id)!.kind, 'commuter-1000');
    assert.deepEqual(serviceOf(c.route, id)!.units, [6], `${source.id}/${id} 1000系6両単独`);
    assert.equal(c.route.trainLength, 120);
    resetState(c.state, c.route);
    assert.deepEqual(serviceOf(c.route, id)!.units, [6]);
    cases++;
    if (id === 'local') {
      const denied = context(source, id, { local: { kind: 'commuter-9000', units: [4, 4] } });
      assert.notEqual(serviceOf(denied.route, id)!.kind, 'commuter-9000', '普通に9000系を出さない');
      cases++;
    } else {
      const old = context(source, id, { [id]: { kind: 'commuter-9000', units: [6] } });
      assert.equal(serviceOf(old.route, id)!.kind, 'commuter-9000');
      assert.deepEqual(serviceOf(old.route, id)!.units, [4, 4]);
      assert.equal(old.route.trainLength, 160);
      const game = createGame(old);
      game.actions.selectVehicle({ kind: 'commuter-1000' });
      assert.deepEqual(old.service!.units, [6]);
      game.actions.selectVehicle({ kind: 'commuter-new', units: [4, 2] });
      assert.deepEqual(old.service!.units, [4, 2], '8300系の既存編成へ戻せる');
      cases++;
    }
  }
  const original = source.services?.find(s => s.id === 'southern');
  if (!original) continue;
  if (context(source, 'southern').state.sel.service !== 'southern') continue; // 日中にこのコースを走るサザンが実ダイヤに無い
  const reservedAt = original.unitKinds!.indexOf('southern-10000');
  for (const freeKind of ['commuter-new', 'commuter-9000'] as const) {
    const chosen: VehicleSel = { southern: { kind: 'southern-12000', units: [4, 4], freeKind } };
    const c = context(source, 'southern', chosen), game = createGame(c);
    const expected: TrainKind[] = reservedAt === 0 ? ['southern-12000', freeKind] : [freeKind, 'southern-12000'];
    assert.deepEqual(c.service!.unitKinds, expected, `${source.id} 12000系の方向と相手`);
    assert.equal(c.service!.kind, expected[0]);
    assert.deepEqual(c.service!.units, [4, 4]);
    assert.equal(c.service!.cars, 8);
    assert.equal(c.trainEnv.perf!.a0, TRAIN_PERF['southern-12000'].a0, '混成全体の起動性能');
    const restored = context(source, 'southern', JSON.parse(JSON.stringify(c.state.sel.vehicles)));
    assert.deepEqual(serviceOf(restored.route, 'southern')!.unitKinds, expected, '選択の復元');
    game.actions.selectVehicle({ freeKind: freeKind === 'commuter-new' ? 'commuter-9000' : 'commuter-new' });
    assert.ok(c.service!.unitKinds!.includes('southern-12000'), '相手変更で指定席車を保持');
    game.actions.selectVehicle({ kind: 'southern-10000' });
    assert.deepEqual(c.service!.unitKinds, original.unitKinds, '既存10000系＋7100系へ戻る');
    game.actions.selectVehicle({ kind: 'southern-12000' });
    assert.ok(!c.service!.unitKinds!.includes('commuter-old'), '12000系に7100系を併結しない');
    cases++;
  }
  const invalid = context(source, 'southern', {
    southern: { kind: 'southern-12000', units: [6], freeKind: 'commuter-old' },
  });
  assert.deepEqual(serviceOf(invalid.route, 'southern')!.units, [4, 4]);
  assert.ok(!serviceOf(invalid.route, 'southern')!.unitKinds!.includes('commuter-old'));
  cases++;
}
// 7169編成の専用回帰: 選択候補、4両固定、保存復元、通常7100系同等性能を確認する。
for (const source of coastal) {
  const spec = source.services?.find(s => s.id === 'local' || s.id === 'express');
  if (!spec || context(source, spec.id).state.sel.service !== spec.id) continue;
  const options = playerVehicleOptions(spec);
  assert.ok(options.kinds.includes('commuter-7100-restored'), `${source.id}/${spec.id} 復元塗装を選択可能`);
  const chosen = context(source, spec.id, { [spec.id]: { kind: 'commuter-7100-restored', units: [6] } });
  createGame(chosen); const chosenService = serviceOf(chosen.route, spec.id)!;
  assert.equal(chosenService.kind, 'commuter-7100-restored');
  assert.deepEqual(chosenService.units, [4], '復元塗装は4両固定');
  assert.equal(chosenService.cars, 4);
  assert.equal(chosen.route.trainLength, 80);
  assert.equal(chosen.trainEnv.perf!.a0, TRAIN_PERF['commuter-old'].a0, '通常7100系と同じ加速度');
  assert.equal(chosen.trainEnv.perf!.vMax, TRAIN_PERF['commuter-old'].vMax, '通常7100系と同じ最高速度');
  const saved = JSON.parse(JSON.stringify(chosen.state.sel.vehicles));
  const restored = context(source, spec.id, saved); createGame(restored); const restoredService = serviceOf(restored.route, spec.id)!;
  assert.equal(restoredService.kind, 'commuter-7100-restored', '復元塗装の保存復元');
  assert.deepEqual(restoredService.units, [4]);
  resetState(restored.state, restored.route);
  assert.deepEqual(serviceOf(restored.route, spec.id)!.units, [4], '復元塗装のリセット後も4両固定');
  cases++;
}
console.log(`追加車両・保存・方向別併結・既存運行 ${cases} ケース合格`);
