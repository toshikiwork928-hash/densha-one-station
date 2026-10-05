// 時刻表の生成: 種別ごとに自動運転（最速走行）で各駅の到着・通過時刻を求め、+5% を 5 秒単位に切り上げる
// 実行: npm run timetable（src/route/routes/shiokaze-timetable.ts・mountain-timetable.ts を書き換える）
// 山岳線（単線）は先の下り勾配の分だけ計画減速度を下げる（抑速ブレーキなしで制限を守る運転）。上り勾配では車両性能で遅くなる
import { writeFileSync } from 'node:fs';
import { shiokaze, shiokazeUp } from '../src/route/routes/shiokaze';
import { mountain, mountainUp } from '../src/route/routes/mountain';
import { meetDwell } from '../src/game/meet';
import { waitDwell } from '../src/game/overtake';
import { applyService } from '../src/route/service';
import { buildTrack } from '../src/route/track';
import type { Route, ServiceId } from '../src/route/types';
import { TRAIN_PERF, stepTrain, type TrainState } from '../src/sim/train';

/** 停車時間 [s]（普通の待避駅は優等列車の到着・通過待ち込み。game/overtake.ts の運動計画から求める） */
const DWELL = 25;
const MARGIN = 1.05, DT = 1 / 30;

function run(route: Route, id: ServiceId) {
  const svc = applyService(route, id)!;
  const track = buildTrack(route), perf = TRAIN_PERF[svc.kind];
  const env = { adhesion: 1, gradePermil: 0, perf };
  const plan0 = perf.bMax * .62; // 計画減速度（B5 相当）
  const tr: TrainState = { s: route.startS, v: 0, acc: 0, notch: 0 };
  const out: Record<number, { arr: number; dep?: number }> = { 0: { arr: 0, dep: 0 } };
  let t = 0;
  const stops = svc.stops.slice(1);
  let si = 0;
  for (let i = 1; i < route.stations.length; i++) {
    const sta = route.stations[i], stop = svc.stops.includes(i);
    // 次の停車位置まで（通過駅は通過時刻を記録）
    for (; ;) {
      const target = route.stations[stops[si]].stopS;
      // 先の制限・停車位置に対する許容速度
      const vNow = tr.v;
      let plan = plan0;
      if (route.singleTrack) {
        let g = 0;
        for (let d = 0; d < 800; d += 20) g = Math.min(g, track.gradeAt(tr.s + d));
        plan = Math.max(.2, perf.bMax * .75 - 9.81 * -g / 1000);
      }
      let vAllow = track.limitAt(tr.s) / 3.6;
      for (let d = 5; d < 2500; d += 5) {
        const q = tr.s + d;
        const lim = q >= target ? 0 : track.limitAt(q) / 3.6;
        vAllow = Math.min(vAllow, Math.sqrt(lim * lim + 2 * plan * Math.max(0, (q >= target ? target - tr.s : d) - 1)));
        if (q >= target) break;
      }
      if (vNow > vAllow + .05) tr.notch = -Math.min(8, Math.max(1, Math.ceil((vNow - vAllow) * 8 + 4)));
      else if (vNow > vAllow - .6) tr.notch = 0;
      else tr.notch = 5;
      env.gradePermil = track.gradeAt(tr.s);
      const before = tr.s;
      stepTrain(tr, env, DT); t += DT;
      if (!stop && before < sta.stopS && tr.s >= sta.stopS) { out[i] = { arr: Math.round(t) }; break; }
      if (stop && (tr.v < .05 && target - tr.s < 1.5 || tr.s >= target)) { tr.v = 0; tr.acc = 0; tr.s = target; break; }
      if (t > 3000) throw new Error(`timeout ${id} @${tr.s}`);
    }
    if (stop) {
      si++;
      const last = i === route.stations.length - 1;
      const w = svc.waits?.find(x => x.station === i);
      const meet = route.meets?.some(m => m.station === i);
      const dwell = meet ? meetDwell() : !w ? DWELL : waitDwell(route, i, route.services!.find(x => x.id === w.passedBy)!, svc.cars);
      out[i] = last ? { arr: t } : { arr: t, dep: t + dwell };
      if (!last) t += dwell;
    }
  }
  return out;
}

const up = (x: number) => Math.ceil(x * MARGIN / 5) * 5;
function table(route: Route): Record<string, string> {
  const res: Record<string, string> = {};
  for (const id of (route.services ?? []).map(v => v.id)) {
    const raw = run(route, id);
    // 駅間の走行時間に余裕を足し、停車時間はそのまま
    let prevRaw = 0, prevOut = 0;
    const tt: string[] = [];
    for (const k of Object.keys(raw).map(Number).sort((a, b) => a - b)) {
      const r = raw[k];
      const arr = k === 0 ? 0 : prevOut + up(r.arr - prevRaw);
      const dep = r.dep != null ? arr + (r.dep - r.arr) : undefined;
      tt.push(`${k}: { arr: ${arr}${dep != null ? `, dep: ${dep}` : ''} }`);
      prevRaw = r.dep ?? r.arr; prevOut = dep ?? arr;
      console.log(route.id, id, k, route.stations[k].name, r.arr.toFixed(1), '→', arr, dep ?? '');
    }
    res[id] = `{ ${tt.join(', ')} }`;
  }
  return res;
}
const dn = table(shiokaze), upT = table(shiokazeUp);
const body = (r: Record<string, string>) => `{
  local: ${r.local},
  express: ${r.express},
  limited: ${r.limited},
}`;
writeFileSync('src/route/routes/shiokaze-timetable.ts', `// 汐風線の時刻表（scripts/timetable.ts が生成。手で直さない）
import type { ServiceId, ServiceSpec } from '../types';

/** 下り（桜ヶ丘 → 岬口） */
export const TT: Record<ServiceId, ServiceSpec['timetable']> = ${body(dn)};

/** 上り（岬口 → 桜ヶ丘） */
export const TT_UP: Record<ServiceId, ServiceSpec['timetable']> = ${body(upT)};
`);

const mDn = table(mountain), mUp = table(mountainUp);
writeFileSync('src/route/routes/mountain-timetable.ts', `// 霧峰線の時刻表（scripts/timetable.ts が生成。手で直さない）
import type { ServiceSpec } from '../types';

/** 下り（川原町 → 雲ノ橋） */
export const MT: Record<'local', ServiceSpec['timetable']> = {
  local: ${mDn.local},
};

/** 上り（雲ノ橋 → 川原町） */
export const MT_UP: Record<'local', ServiceSpec['timetable']> = {
  local: ${mUp.local},
};
`);
