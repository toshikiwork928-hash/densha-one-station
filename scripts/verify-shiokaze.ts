// 描画を伴わない運行回帰チェック。esbuild で Node 向けに束ねて実行する。
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { shiokaze, shiokazeUp } from '../src/route/routes/shiokaze';
import { mountain, mountainUp } from '../src/route/routes/mountain';
import { buildTrack } from '../src/route/track';
import { loopZone } from '../src/route/service';
import type { Route, ServiceId } from '../src/route/types';
import { createState } from '../src/game/state';
import { createGame } from '../src/game/loop';
import { EventBus } from '../src/core/events';
import { createTrainEnv } from '../src/sim/train';
import { createRng } from '../src/core/rng';
import { attachAutodrive } from '../src/debug/autodrive';
import { terminalSpeedLimit, TERMINAL_CHECKPOINTS } from '../src/game/terminal-ats';
import type { GameContext } from '../src/core/context';
import { createSignalSystem } from '../src/game/signals';

(globalThis as any).window = {};

function context(source: Route, service: ServiceId): GameContext {
  const route = structuredClone(source);
  return { route, track: buildTrack(route), events: new EventBus(), state: createState(route, { stageId: 'all', service, mode: 'normal', vehicles: {} }),
    trainEnv: createTrainEnv(), scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), renderer: null!, env: null!, rng: createRng(12345),
    assetsReady: true, envState: { timeOfDay: 'noon', weather: 'clear', intensity: 0 }, light: { night: 0, tunnel: 0 }, cameraMode: 'cab', actions: null! };
}

for (const route of [shiokaze, shiokazeUp]) {
  assert.equal(route.stations.length, 10);
  assert.equal(route.stations[9].stopS - route.stations[0].stopS, 10600);
  const geometry = buildTrack(route);
  assert.equal(geometry.length, 11200, '汐風線の線形総延長');
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

for (const source of [shiokaze, shiokazeUp, mountain, mountainUp]) {
  for (const service of source.theme === 'mountain' ? ['local'] as const : ['local', 'express', 'limited'] as const) {
    const ctx = context(source, service), game = createGame(ctx);
    attachAutodrive(ctx, (sec, dt = 1 / 30, hook) => {
      for (let t = 0; t < sec; t += dt) { if (hook?.()) break; game.update(dt); }
    });
    const result = (globalThis as any).window.__qa.run(service, 'all', 3600);
    console.log(JSON.stringify({ route: source.id, service, state: ctx.state.state, s: ctx.state.train.s, time: result.t,
      ats: ctx.state.penalties.atsBrake, overspeed: ctx.state.overspeed, stops: ctx.state.stops.length, final: result.log.slice(-3) }));
    assert.equal(ctx.state.state, 'result', `${source.id}/${service}完走`);
    assert.equal(ctx.state.penalties.atsBrake, 0, `${source.id}/${service}正常運転でATS非常制動なし`);
    assert.equal(result.overspeed, 0, `${source.id}/${service}全区間（終着ATS速度曲線含む）で速度超過減点なし`);
    assert.ok(Math.abs(ctx.state.train.s - ctx.route.stations.at(-1)!.stopS) < 15, `${source.id}/${service}終着停止`);
  }
}
console.log('運行・終着ATS・復路標高チェック成功');
