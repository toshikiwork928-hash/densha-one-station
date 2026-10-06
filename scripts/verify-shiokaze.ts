// 描画を伴わない運行回帰チェック。esbuild で Node 向けに束ねて実行する。
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { shiokaze, shiokazeUp } from '../src/route/routes/shiokaze';
import { mountain, mountainUp } from '../src/route/routes/mountain';
import { kishiwada, kishiwadaUp } from '../src/route/routes/kishiwada';
import { through, throughUp } from '../src/route/routes/through';
import { approachText, departText } from '../src/audio/announce-text';
import { applyService } from '../src/route/service';
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
import { terminalSpeedLimit } from '../src/game/terminal-ats';
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
  // 終着 ATS は無効。普通は終着の待避線（堺3番線・泉大津1番線）へ入り分岐器制限45km/h、急行・特急は本線ホームで制限なし。
  const target = 9, stop = route.stations[target].stopS;
  assert.ok(!route.terminalApproach, `${route.id}終着ATSは無効`);
  for (const distance of [1000, 600, 300, 120, 50, 0]) assert.equal(terminalSpeedLimit(route, target, stop - distance), Infinity);
  const trackName = route.id === 'shiokaze' ? '3番線' : '1番線';
  for (const service of ['local', 'express', 'limited'] as ServiceId[]) {
    const ctx = context(route, service), sta = ctx.route.stations[target], loop = service === 'local';
    assert.equal(!!sta.enterLoop, loop, `${route.id}/${service}終着の待避線入線`);
    if (loop) assert.equal(sta.loopTrack, trackName, `${route.id}終着の番線名`);
    const z = loopZone(sta)!;
    assert.equal(ctx.track.limitAt(z.inFrom + 10), loop ? 45 : ctx.route.lineLimit, `${route.id}/${service}終着入線の制限`);
    assert.equal(ctx.track.limitAt(stop - 40) <= (loop ? 45 : 999), true);
    ctx.state.target = target;
    let eb = 0; const ats = createSignalSystem(ctx, () => eb++);
    ctx.state.train.s = stop - 40; ctx.state.train.v = 25 / 3.6; ctx.state.nextSignal = -1; ats.update(1 / 60, true);
    assert.equal(eb, 0, `${route.id}/${service}終着で低速進入ATSの非常制動なし`);
  }
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
    let heldStation = -1, zoneMax = 0;
    const finalSta = ctx.route.stations.at(-1)!, finalZone = loopZone(finalSta)!;
    attachAutodrive(ctx, (sec, dt = 1 / 30, hook) => {
      for (let t = 0; t < sec; t += dt) {
        if (hook?.()) break; game.update(dt);
        const st = ctx.state, o = st.overtake;
        if (source.theme === 'coast' && st.train.s > finalZone.inFrom + 20 && st.train.s < finalZone.outTo) zoneMax = Math.max(zoneMax, st.train.v * 3.6);
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
      console.log(`  終着入線 ${service}: 入線区間の最高速 ${zoneMax.toFixed(1)}km/h 番線案内=${result.log.some((l: string) => l.includes('入線'))}`);
      if (service === 'local') {
        assert.ok(zoneMax <= 45 + 1, `${source.id}普通は終着の待避線入線で45km/h制限を保持`);
        assert.ok(result.log.some((l: string) => l.includes(`${finalSta.loopTrack}へ入線`)), `${source.id}終着の番線予告バナー`);
      } else assert.ok(!result.log.some((l: string) => l.includes('入線')), `${source.id}/${service}は入線案内なし`);
    }
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

// 南海本線 泉大津〜岸和田（特急サザン）: 線形・踏切・駅の形と、4種別×上下の完走
for (const route of [kishiwada, kishiwadaUp]) {
  assert.equal(route.stations.length, 5);
  assert.equal(route.stations[4].stopS - route.stations[0].stopS, 5600, '泉大津〜岸和田 5.6km');
  const geometry = buildTrack(route);
  for (const crossing of route.crossings ?? []) {
    const half = (crossing.roadWidth ?? 6) / 2;
    for (const station of route.stations) assert.ok(crossing.s + half < station.platform.from || crossing.s - half > station.platform.to, `${route.id}/${crossing.id}踏切道路がホームを横切らない`);
    for (const structure of route.structures ?? []) assert.ok(crossing.s + half < structure.from || crossing.s - half > structure.to, `${route.id}/${crossing.id}踏切道路が高架・橋梁に重ならない`);
    assert.ok(Math.abs(geometry.trackAt(crossing.s).y) < .01, `${route.id}/${crossing.id}踏切は地上`);
  }
  for (const station of route.stations) {
    const { from, to } = station.platform, phi = geometry.trackAt(from).phi;
    for (let s = from; s <= to; s += 5) assert.ok(Math.abs(geometry.trackAt(s).phi - phi) < 1e-9, `${route.id}/${station.name}ホーム全体が直線`);
    const loop = loopZone(station);
    if (loop) for (let s = loop.inFrom; s <= loop.outTo; s += 5) assert.ok(Math.abs(geometry.trackAt(s).phi - geometry.trackAt(loop.inFrom).phi) < 1e-9, `${route.id}/${station.name}分岐区間が直線`);
    const y = geometry.trackAt(from).y;
    for (let s = from; s <= to; s += 10) assert.ok(Math.abs(geometry.trackAt(s).y - y) < 1e-6, `${route.id}/${station.name}ホームが水平`);
    assert.equal(y > 1, !!station.elevated, `${route.id}/${station.name}高架/地上`);
  }
  // 泉大津の形は堺〜泉大津と同じ（島式2面4線・待避線の位置）
  const izumi = route.stations.find(s => s.name === '泉大津')!, izumiS = shiokaze.stations[0];
  assert.deepEqual(izumi.loop, izumiS.loop, '泉大津の待避線は既存と同じ');
  assert.equal(izumi.platform.to - izumi.platform.from, izumiS.platform.to - izumiS.platform.from);
  assert.ok(route.stations.find(s => s.name === '岸和田')!.indoor, '岸和田は屋内式');
}
{
  const t = buildTrack(kishiwada), u = buildTrack(kishiwadaUp);
  for (let s = 0; s <= t.length; s += 50) assert.ok(Math.abs(t.trackAt(s).y - u.trackAt(u.length - s).y) < 1e-6, '泉大津〜岸和田 復路の標高一致');
}
// 通し（堺〜岸和田）: 区間データと同じ線形・駅位置・標高をつないだもの
for (const [route, parts] of [[throughUp, [shiokazeUp, kishiwada]], [through, [kishiwadaUp, shiokaze]]] as const) {
  const [a, b] = parts, t = buildTrack(route), ta = buildTrack(a), tb = buildTrack(b);
  assert.equal(route.stations.length, 14);
  assert.ok(Math.abs(route.stations[13].stopS - route.stations[0].stopS - 16200) < 1e-6, `${route.id} 堺〜岸和田 16.2km`);
  const off = a.stations.at(-1)!.platform.from - b.stations[0].platform.from;
  // 境目の前後で、区間データと同じ線路の形（相対位置・方位・標高）
  const rel = (tr: typeof t, s0: number, s1: number) => { const p = tr.trackAt(s0), q = tr.trackAt(s1); return [Math.hypot(q.x - p.x, q.z - p.z), q.phi - p.phi, q.y - p.y]; };
  for (const [s0, s1] of [[off, off + 3000], [off + 500, route.stations[13].stopS]]) {
    const [d, dp, dy] = rel(t, s0, s1), [e, ep, ey] = rel(tb, s0 - off, s1 - off);
    assert.ok(Math.abs(d - e) < .05 && Math.abs(dp - ep) < 1e-6 && Math.abs(dy - ey) < 1e-6, `${route.id} b の区間の形が一致`);
  }
  {
    const [d, dp, dy] = rel(t, 0, off), [e, ep, ey] = rel(ta, 0, off);
    assert.ok(Math.abs(d - e) < .05 && Math.abs(dp - ep) < 1e-6 && Math.abs(dy - ey) < 1e-6, `${route.id} a の区間の形が一致`);
  }
  for (const st of route.stations) {
    const { from, to } = st.platform, phi = t.trackAt(from).phi;
    for (let q = from; q <= to; q += 5) assert.ok(Math.abs(t.trackAt(q).phi - phi) < 1e-9, `${route.id}/${st.name}ホーム全体が直線`);
  }
  assert.equal(route.coastalLandmarks!.filter(l => l.kind === 'twin-tower').length, 1, 'タワーは1組');
  const ids = route.signals!.map(g => g.id);
  assert.equal(new Set(ids).size, ids.length, '信号 id の重複なし');
}
// 放送: サザンの始発の行先案内と、終点でない終着駅（列車は和歌山市行き）
{
  const r = structuredClone(kishiwada), sv = applyService(r, 'southern')!;
  const dep = departText(r, 0, false, sv);
  assert.ok(dep.includes('この電車は、一部座席指定、特急サザンワカヤマシ行きです。'), dep);
  assert.ok(dep.includes('次は、キシワダに停まります。'), dep);
  assert.ok(!approachText(r, 4, sv).includes('終点'), 'サザンの岸和田は終点ではない');
  const loc = applyService(r, 'local')!;
  assert.ok(approachText(r, 4, loc).includes('終点'), '普通は岸和田止まり');
  const up = structuredClone(kishiwadaUp), su = applyService(up, 'southern')!;
  assert.ok(departText(up, 0, false, su).includes('特急サザンナンバ行き'), '上りのサザンは難波行き');
  assert.deepEqual(su.unitKinds, ['commuter-old', 'southern-10000'], '上りのサザンは 7100系が先頭');
  assert.deepEqual(applyService(structuredClone(kishiwada), 'southern')!.unitKinds, ['southern-10000', 'commuter-old'], '下りのサザンは 10000系が先頭');
}
// 普通の待避駅では、到着前の放送でも待ち合わせ・通過待ちを案内する（堺〜泉大津: 高石で特急の通過待ち）
{
  const r = structuredClone(shiokaze), sv = applyService(r, 'local')!;
  assert.ok(approachText(r, 3, sv).endsWith('タカイシで特急の通過待ちをします。'), approachText(r, 3, sv));
  assert.ok(approachText(r, 5, sv).endsWith('ハマデラコウエンで急行の通過待ちをします。'), approachText(r, 5, sv));
  assert.ok(!approachText(r, 1, sv).includes('待'), '待避しない駅は案内なし');
}
for (const source of [kishiwada, kishiwadaUp, throughUp, through]) {
  for (const service of ['local', 'express', 'limited', 'southern'] as const) {
    const ctx = context(source, service), game = createGame(ctx);
    const finalSta = ctx.route.stations.at(-1)!, finalZone = loopZone(finalSta)!;
    let zoneMax = 0;
    const observedWaits = new Set<number>(), stopT: Record<number, number> = {}, arriveT: Record<number, number> = {};
    attachAutodrive(ctx, (sec, dt = 1 / 30, hook) => {
      for (let t = 0; t < sec; t += dt) {
        if (hook?.()) break; game.update(dt);
        const st = ctx.state;
        if (st.overtake?.localStopped && !st.overtake.cleared) observedWaits.add(st.overtake.station);
        // 優等列車は普通が止まってから着く（到着点 = 停止位置。通過列車は普通の停止位置を通過）
        const o = st.overtake;
        if (o && !o.cleared) {
          const arrive = o.stopAt ?? ctx.route.stations[o.station].stopS;
          if (o.localStopped && stopT[o.station] == null) stopT[o.station] = st.t;
          if (o.head >= arrive - .1 && arriveT[o.station] == null) arriveT[o.station] = st.t;
        }
        if (st.train.s > finalZone.inFrom + 20 && st.train.s < finalZone.outTo) zoneMax = Math.max(zoneMax, st.train.v * 3.6);
      }
    });
    const result = (globalThis as any).window.__qa.run(service, 'all', 3600);
    if (ctx.state.penalties.atsBrake) console.log(result.log.filter((l: string) => /ATS|信号|R|EB|非常/.test(l)).slice(0, 12).join(' | '));
    console.log(JSON.stringify({ route: source.id, service, state: ctx.state.state, time: result.t, ats: ctx.state.penalties.atsBrake, overspeed: ctx.state.overspeed, stops: ctx.state.stops.length }));
    assert.equal(ctx.state.state, 'result', `${source.id}/${service}完走`);
    assert.equal(ctx.state.penalties.atsBrake, 0, `${source.id}/${service}ATS非常制動なし`);
    assert.equal(result.overspeed, 0, `${source.id}/${service}速度超過なし`);
    assert.ok(Math.abs(ctx.state.train.s - finalSta.stopS) < 15, `${source.id}/${service}終着停止`);
    assert.equal(ctx.state.stops.length, ctx.route.services!.find(s => s.id === service)!.stops.length - 1, `${source.id}/${service}停車駅数`);
    if (service === 'local') assert.ok(zoneMax <= 46, `${source.id}普通は終着の待避線へ45km/hで入線`);
    const waits = [...new Set(ctx.route.services!.find(v => v.id === 'local')!.waits?.map(w => w.station) ?? [])];
    assert.deepEqual([...observedWaits], service === 'local' ? waits : [], `${source.id}/${service}普通の待避`);
    for (const k of Object.keys(stopT)) {
      const gap = arriveT[+k] - stopT[+k];
      console.log(`  待避 ${ctx.route.stations[+k].name}: 普通の停止から優等列車の到着まで ${gap.toFixed(1)}秒`);
      assert.ok(gap >= 3, `${source.id}/${ctx.route.stations[+k].name} 優等列車は普通が止まってから着く`);
    }
  }
}
console.log('泉大津〜岸和田・堺〜岸和田（4種別×上下）・サザンの放送チェック成功');
