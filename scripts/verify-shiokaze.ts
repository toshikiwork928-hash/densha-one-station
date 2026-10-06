// 描画を伴わない運行回帰チェック。esbuild で Node 向けに束ねて実行する。
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { shiokaze, shiokazeUp } from '../src/route/routes/shiokaze';
import { mountain, mountainUp } from '../src/route/routes/mountain';
import { buildTrack } from '../src/route/track';
import { loopZone, loopShape } from '../src/route/service';
import { coastalThirdTracks } from '../src/world/coastal-stations';
import type { Route, ServiceId } from '../src/route/types';
import { createState, type VehicleSel } from '../src/game/state';
import { createGame } from '../src/game/loop';
import { EventBus } from '../src/core/events';
import { createTrainEnv } from '../src/sim/train';
import { createRng } from '../src/core/rng';
import { attachAutodrive } from '../src/debug/autodrive';
import { terminalSpeedLimit, TERMINAL_CHECKPOINTS } from '../src/game/terminal-ats';
import type { GameContext } from '../src/core/context';
import { createSignalSystem } from '../src/game/signals';

(globalThis as any).window = {};

function context(source: Route, service: ServiceId, vehicles: VehicleSel = {}): GameContext {
  const route = structuredClone(source);
  return { route, track: buildTrack(route), events: new EventBus(), state: createState(route, { stageId: 'all', service, mode: 'normal', vehicles }),
    trainEnv: createTrainEnv(), scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), renderer: null!, env: null!, rng: createRng(12345),
    assetsReady: true, envState: { timeOfDay: 'noon', weather: 'clear', intensity: 0 }, light: { night: 0, tunnel: 0 }, cameraMode: 'cab', actions: null! };
}

for (const route of [shiokaze, shiokazeUp]) {
  assert.equal(route.stations.length, 10);
  assert.equal(route.stations[9].stopS - route.stations[0].stopS, 10600);
  const geometry = buildTrack(route);
  assert.equal(geometry.length, 11200, '南海本線の線形総延長');
  for (const crossing of route.crossings ?? []) {
    const half = (crossing.roadWidth ?? 6) / 2;
    for (const station of route.stations) assert.ok(crossing.s + half < station.platform.from || crossing.s - half > station.platform.to,
      `${route.id}/${crossing.id}踏切道路がホームを横切らない`);
    for (const structure of route.structures ?? []) assert.ok(crossing.s + half < structure.from || crossing.s - half > structure.to,
      `${route.id}/${crossing.id}踏切道路が高架・橋梁に重ならない`);
    assert.ok(Math.abs(geometry.trackAt(crossing.s).y) < .01, `${route.id}/${crossing.id}踏切は地上`);
  }
  for (const station of route.stations) {
    const { from, to } = station.platform, phi = geometry.trackAt(from).phi;
    assert.ok(Math.abs(geometry.trackAt(to).phi - phi) < 1e-9, `${route.id}/${station.name}ホーム両端の方位一致`);
    // S字で両端だけ同じ方位になるケースも検知する。
    for (let s = from; s <= to; s += 5) assert.ok(Math.abs(geometry.trackAt(s).phi - phi) < 1e-9, `${route.id}/${station.name}ホーム全体が直線`);
    const loop = loopZone(station);
    if (loop) {
      const approachPhi = geometry.trackAt(loop.inFrom).phi;
      for (let s = loop.inFrom; s <= loop.outTo; s += 5) assert.ok(Math.abs(geometry.trackAt(s).phi - approachPhi) < 1e-9, `${route.id}/${station.name}待避線分岐区間の本線が直線`);
    }
    for (const structure of route.structures ?? []) {
      if (structure.kind === 'bridge') assert.ok(to <= structure.from || from >= structure.to, `${route.id}/${station.name}ホームと橋梁区間が重ならない`);
    }
  }
  const target = 9, stop = route.stations[target].stopS;
  for (const [distance, limit] of TERMINAL_CHECKPOINTS) assert.equal(terminalSpeedLimit(route, target, stop - distance), limit);
  assert.equal(terminalSpeedLimit(route, 8, stop - 10), Infinity);
  const ctx = context(route, 'express'); ctx.state.target = 9;
  let eb = 0; const ats = createSignalSystem(ctx, () => eb++);
  ctx.state.train.s = ctx.route.stations[9].stopS - 40; ctx.state.train.v = 25 / 3.6;
  ctx.state.nextSignal = -1; ats.update(1 / 60, true); assert.equal(eb, 1, '終着照査で非常制動');
  ctx.state.train.v = 0; assert.equal(ats.ack(), true);
}
const downTrack = buildTrack(shiokaze), upTrack = buildTrack(shiokazeUp);
for (let s = 0; s <= downTrack.length; s += 50) assert.ok(Math.abs(downTrack.trackAt(s).y - upTrack.trackAt(upTrack.length - s).y) < 1e-6, '復路の標高一致');

const expectedWaits = new Map([
  ['shiokaze', [['高石', 'limited'], ['浜寺公園', 'express']]],
  ['shiokaze-up', [['浜寺公園', 'express'], ['高石', 'limited']]],
]);
for (const route of [shiokaze, shiokazeUp]) {
  const waits = route.services!.find(s => s.id === 'local')!.waits!;
  assert.deepEqual(waits.map(w => [route.stations[w.station].name, w.passedBy]), expectedWaits.get(route.id));
  for (const w of waits) {
    assert.ok(w.station > 0 && w.station < 9, '起終点では通過待ちしない');
    assert.ok(loopZone(route.stations[w.station]), '待避線へ進入可能');
    assert.ok(!route.services!.find(s => s.id === w.passedBy)!.stops.includes(w.station), '優等列車は待避駅を通過');
  }
}
const parkDown = shiokaze.stations.find(s => s.layout === 'hamadera')!;
const parkUp = shiokazeUp.stations.find(s => s.layout === 'hamadera')!;
const [izumiDown, sakaiDown] = coastalThirdTracks(shiokaze, parkDown), [izumiUp, sakaiUp] = coastalThirdTracks(shiokazeUp, parkUp);
const zoneDown = loopZone(parkDown)!, zoneUp = loopZone(parkUp)!;
// 自線側の副線は普通の走行位置と一致。両方向で同一の物理4線（泉大津方面の島式外側線・堺方面の待避線）。
for (let s = sakaiDown.from; s <= sakaiDown.to; s += 2) assert.ok(Math.abs(sakaiDown.lat(s) - zoneDown.lat * loopShape(zoneDown, s)) < 1e-9, '下り: 普通の走行位置と堺方面待避線が一致');
for (let s = izumiUp.from; s <= izumiUp.to; s += 2) assert.ok(Math.abs(izumiUp.lat(s) - zoneUp.lat * loopShape(zoneUp, s)) < 1e-9, '上り: 普通の走行位置と泉大津方面副線が一致');
for (const s of [izumiDown.from, (izumiDown.from + izumiDown.to) / 2, izumiDown.to - 1]) {
  assert.ok(Math.abs(izumiDown.lat(11200 - s) + izumiUp.lat(s) - 4) < 1e-9, '両方向で同一の物理配置（泉大津方面副線）');
  assert.ok(Math.abs(sakaiDown.lat(11200 - s) + sakaiUp.lat(s) - 4) < 1e-9, '両方向で同一の物理配置（堺方面待避線）');
}
// 諏訪ノ森: 上下ホームは踏切を挟んで離れ、重ならない。
for (const route of [shiokaze, shiokazeUp]) {
  const suwa = route.stations.find(s => s.name === '諏訪ノ森')!, opp = { from: suwa.platform.from + suwa.platformOpp!, to: suwa.platform.to + suwa.platformOpp! };
  const gap = route.crossings!.filter(c => c.s > Math.min(suwa.platform.to, opp.to) && c.s < Math.max(suwa.platform.from, opp.from));
  assert.ok(opp.from > suwa.platform.to + 20 && gap.length === 1, `${route.id}: 諏訪ノ森の上下ホームは踏切を挟んで離れる`);
}
// 石津川〜湊は直線、湊は島式。
{
  const t = buildTrack(shiokaze), ishi = shiokaze.stations[7], minato = shiokaze.stations[8];
  for (let s = ishi.platform.from; s <= minato.platform.to; s += 10) assert.ok(Math.abs(t.trackAt(s).phi - t.trackAt(ishi.platform.from).phi) < 1e-9, '石津川〜湊は直線');
  assert.ok(minato.island && !minato.loop, '湊は島式ホーム');
}

for (const source of [shiokaze, shiokazeUp, mountain, mountainUp]) {
  for (const service of source.theme === 'mountain' ? ['local'] as const : ['local', 'express', 'limited'] as const) {
    const ctx = context(source, service), game = createGame(ctx);
    const observedWaits = new Set<number>(), observedSidings = new Set<number>();
    let heldStation = -1;
    attachAutodrive(ctx, (sec, dt = 1 / 30, hook) => {
      for (let t = 0; t < sec; t += dt) {
        if (hook?.()) break; game.update(dt);
        const st = ctx.state, o = st.overtake;
        if (o?.localStopped && !o.cleared) {
          observedWaits.add(o.station);
          if (heldStation === o.station) assert.equal(st.signals[o.depSignal], 'R', '優等列車が抜けるまで普通の出発信号は停止');
          heldStation = o.station;
        }
        if (service !== 'local') for (const w of ctx.route.services?.find(s => s.id === 'local')?.waits ?? []) {
          if (w.passedBy !== service) continue;
          const sta = ctx.route.stations[w.station], z = loopZone(sta)!;
          if (Math.abs(st.train.s - sta.stopS) < 20) {
            assert.ok(st.precedingS >= z.inTo + 80 && st.precedingS <= z.outFrom, '優等列車が通過時、普通全車が待避線内');
            observedSidings.add(w.station);
          }
        }
      }
    });
    const result = (globalThis as any).window.__qa.run(service, 'all', 3600);
    console.log(JSON.stringify({ route: source.id, service, state: ctx.state.state, s: ctx.state.train.s, time: result.t,
      ats: ctx.state.penalties.atsBrake, overspeed: ctx.state.overspeed, stops: ctx.state.stops.length, final: result.log.slice(-3) }));
    assert.equal(ctx.state.state, 'result', `${source.id}/${service}完走`);
    assert.equal(ctx.state.penalties.atsBrake, 0, `${source.id}/${service}正常運転でATS非常制動なし`);
    assert.equal(result.overspeed, 0, `${source.id}/${service}全区間（終着ATS速度曲線含む）で速度超過減点なし`);
    assert.ok(Math.abs(ctx.state.train.s - ctx.route.stations.at(-1)!.stopS) < 15, `${source.id}/${service}終着停止`);
    if (source.theme === 'coast') {
      const waits = ctx.route.services!.find(s => s.id === 'local')!.waits!;
      assert.deepEqual([...observedWaits], service === 'local' ? waits.map(w => w.station) : [], '普通の通過待ちを指定順で実施');
      assert.deepEqual([...observedSidings], service === 'local' ? [] : waits.filter(w => w.passedBy === service).map(w => w.station), '指定駅で先行普通の待避を確認');
    }
  }
}
console.log('運行・終着ATS・復路標高チェック成功');

// 最大編成でも第3線への進入・本線通過が成立する。
for (const service of ['local', 'express'] as const) {
  const ctx = context(shiokazeUp, service, {
    local: { kind: 'commuter-old', units: [4, 2] }, express: { kind: 'commuter-new', units: [4, 4] },
  });
  const game = createGame(ctx);
  attachAutodrive(ctx, (sec, dt = 1 / 30, hook) => {
    for (let t = 0; t < sec; t += dt) { if (hook?.()) break; game.update(dt); }
  });
  const result = (globalThis as any).window.__qa.run(service, 'all', 3600);
  assert.equal(ctx.state.state, 'result', `最大編成/${service}完走`);
  assert.equal(ctx.state.penalties.atsBrake, 0);
  assert.equal(result.overspeed, 0);
}
console.log('普通6両・急行8両の待避運行成功');
