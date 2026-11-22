import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { ROUTES } from '../src/route';
import { applyService, selectableServices } from '../src/route/service';
import { realDayOf, realTrainFor } from '../src/route/real-diagram';
import { createState, departureTime, stagesOf } from '../src/game/state';
import { normalCruiseSpeed } from '../src/game/timetable-pace';
import { terminalSpeedLimit } from '../src/game/terminal-ats';
import { buildTrack } from '../src/route/track';
import { TRAIN_PERF, stepTrain, type TrainPerf } from '../src/sim/train';
import type { Route } from '../src/route/types';

// 2mごとに先の制限と停車位置から逆算し、同じブレーキ操作で力行調整の有無を比べる。
function measure(route: Route, from: number, to: number, seconds: number, perf: TrainPerf, assisted: boolean) {
  const track = buildTrack(route);
  const start = route.stations[from].stopS, end = route.stations[to].stopS;
  const count = Math.ceil((end - start) / 2), ds = (end - start) / count;
  const allowed = new Float64Array(count + 1);
  for (let i = count - 1; i >= 0; i--) {
    const s = start + i * ds;
    const limit = Math.min(track.limitAt(s), terminalSpeedLimit(route, to, s)) / 3.6;
    const brake = Math.max(.2, perf.bMax * .60 + Math.min(0, track.gradeAt(s)) * .00981);
    allowed[i] = Math.min(limit, Math.sqrt(allowed[i + 1] ** 2 + 2 * brake * ds));
  }
  const tr = { s: start, v: 0, acc: 0, notch: 5 };
  const dt = .1;
  for (let t = 0; t < 3600; t += dt) {
    if (tr.s >= end || (end - tr.s < 1.5 && tr.v < .1)) return Math.round(t);
    const i = Math.min(count - 1, Math.floor((tr.s - start) / ds));
    const speed = allowed[i] + (allowed[i + 1] - allowed[i]) * ((tr.s - start) / ds - i);
    const grade = track.gradeAt(tr.s);
    const predicted = tr.v + Math.max(0, tr.acc - grade * .00981) * .9;
    tr.notch = predicted > speed ? -Math.min(8, Math.ceil((predicted - speed) * 6 + 3)) : tr.v > speed - .5 ? 0 : 5;
    const limit = Math.min(track.limitAt(tr.s), terminalSpeedLimit(route, to, tr.s), perf.vMax * 3.6);
    const cap = assisted ? normalCruiseSpeed(end - tr.s, seconds - t, tr.v, perf, limit) : null;
    stepTrain(tr, { adhesion: 1, gradePermil: grade, perf }, dt, cap ?? Infinity);
  }
  throw new Error(route.id + ': ' + from + '→' + to + ' 計測未完了');
}

const rows = [];
const seen = new Set<string>();
for (const source of Object.values(ROUTES)) {
  const mountain = source.id === 'mountain' || source.id === 'mountain-up';
  if (!realDayOf(source) && !mountain) continue;
  for (const timeOfDay of ['morning', 'noon', 'evening', 'night'] as const) {
    const route = Object.assign(structuredClone(source), { timeOfDay });
    for (const { id: service } of selectableServices(route)) {
      const svc = applyService(route, service)!;
      const perf = TRAIN_PERF[svc.id === 'southern' && svc.unitKinds?.includes('southern-12000') ? 'southern-12000' : svc.kind];
      for (const stage of stagesOf(route)) {
        createState(route, { service, stageId: stage.id, vehicles: {}, mode: 'normal' });
        const train = realTrainFor(route, service, stage.from, stage.to)?.no;
        let from = stage.from;
        for (let to = from + 1; to <= stage.to; to++) {
          const station = route.stations[to];
          if (station.pass) continue;
          const seconds = station.scheduledArrival - departureTime(route, from);
          const key = [route.id, timeOfDay, service, train, from, to, seconds].join('/');
          if (!seen.has(key)) {
            seen.add(key);
            const baseline = measure(route, from, to, seconds, perf, false);
            const normal = measure(route, from, to, seconds, perf, true);
            rows.push({ route: route.id, timeOfDay, service, train, from: route.stations[from].name, to: station.name, seconds, baseline, normal });
          }
          from = to;
        }
      }
    }
  }
}
const southern43 = rows.filter(row => row.train === '0603' && row.to === '和歌山市');
assert(southern43.length > 0);
for (const section of southern43) {
  assert(Math.abs(section.seconds - section.normal) < 30, 'サザン43号の通常運転で大幅な早着・遅着');
}
writeFileSync('node_modules/.cache/runtime-benchmark.json', JSON.stringify(rows));
for (const mountain of [false, true]) {
  const sample = rows.filter(r => r.route.startsWith('mountain') === mountain);
  console.log(mountain ? '高野線短縮' : '南海本線・和歌山港線', new Set(sample.map(r => r.route)).size, 'コース', sample.length, '駅間条件');
  for (const mode of ['baseline', 'normal'] as const) {
    const deltas = sample.map(r => r[mode] - r.seconds).sort((a,b) => a-b);
    console.log(mode, '中央値', deltas[Math.floor(deltas.length / 2)], '秒、60秒以上早着', deltas.filter(d => d <= -60).length, '件');
  }
}
