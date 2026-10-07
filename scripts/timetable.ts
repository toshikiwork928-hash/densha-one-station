// 時刻表の生成: 種別ごとに自動運転（最速走行）で各駅の到着・通過時刻を求め、+5% を 5 秒単位に切り上げる
// 実行: npm run timetable（src/route/routes/shiokaze-timetable.ts・mountain-timetable.ts を書き換える）
// 山岳線（単線）は先の下り勾配の分だけ計画減速度を下げる（抑速ブレーキなしで制限を守る運転）。上り勾配では車両性能で遅くなる
import { writeFileSync } from 'node:fs';
import { shiokaze, shiokazeUp } from '../src/route/routes/shiokaze';
import { kishiwada, kishiwadaUp } from '../src/route/routes/kishiwada';
import { through, throughUp } from '../src/route/routes/through';
import { namba, nambaUp } from '../src/route/routes/namba';
import { mountain, mountainUp } from '../src/route/routes/mountain';
import { meetDwell } from '../src/game/meet';
import { waitDwell, waitsAt } from '../src/game/overtake';
import { terminalSpeedLimit } from '../src/game/terminal-ats';
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
  // 始発駅で待つ（朝の堺1番線で急行を待ち合わせなど）: 待避の停車時間だけ遅れて発車
  const w0 = waitsAt(route, svc, 0), dwell0 = w0.length ? waitDwell(route, 0, w0, svc.cars) : 0;
  const out: Record<number, { arr: number; dep?: number }> = { 0: { arr: 0, dep: dwell0 } };
  let t = dwell0;
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
      let vAllow = Math.min(track.limitAt(tr.s), terminalSpeedLimit(route, stops[si], tr.s)) / 3.6;
      for (let d = 5; d < 2500; d += 5) {
        const q = tr.s + d;
        const lim = q >= target ? 0 : Math.min(track.limitAt(q), terminalSpeedLimit(route, stops[si], q)) / 3.6;
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
      const ws = waitsAt(route, svc, i), w = ws.length > 0;
      const meet = route.meets?.some(m => m.station === i);
      const dwell = meet ? meetDwell() : !w ? DWELL : waitDwell(route, i, ws, svc.cars);
      out[i] = last ? { arr: t } : { arr: t, dep: t + dwell };
      if (!last) t += dwell;
    }
  }
  return out;
}

const up = (x: number) => Math.ceil(x * MARGIN / 5) * 5;
function table(route: Route): Record<string, string> {
  const res: Record<string, string> = {};
  for (const id of (route.services ?? []).map(v => v.id)) res[id] = tableOf(route, id, true);
  return res;
}
/** 1種別の時刻表（ソースの文字列） */
function tableOf(route: Route, id: ServiceId, log = false): string {
  {
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
      if (log) console.log(route.id, id, k, route.stations[k].name, r.arr.toFixed(1), '→', arr, dep ?? '');
    }
    return `{ ${tt.join(', ')} }`;
  }
}
// 時間帯ごとの普通の時刻表（待避で停車時間が変わる）。全コースの普通（時間帯のパターンを持つもの）
{
  const lines: string[] = [];
  for (const route of [shiokaze, shiokazeUp, kishiwadaUp, throughUp, through, namba, nambaUp]) {
    const local = route.services?.find(v => v.id === 'local');
    if (!local?.waitsByTime) continue;
    const byTod: string[] = [];
    for (const tod of ['morning', 'noon', 'evening', 'night'] as const) {
      route.timeOfDay = tod;
      local.timetableByTime = undefined; // 生成中は基準の時刻表から
      byTod.push(`${tod}: ${tableOf(route, 'local')}`);
    }
    route.timeOfDay = undefined;
    lines.push(`  '${route.id}': {\n    ${byTod.join(',\n    ')},\n  },`);
  }
  writeFileSync('src/route/routes/local-timetables.ts', `// 時間帯ごとの普通の時刻表（待避で停車時間が変わる。scripts/timetable.ts が生成。手で直さない）
import type { ServiceSpec, TimeOfDay } from '../types';

export const LOCAL_TT: Record<string, Partial<Record<TimeOfDay, ServiceSpec['timetable']>>> = {
${lines.join('\n')}
};
`);
}

// --namba-only は堺〜難波だけ更新
const nambaOnly = process.argv.includes('--namba-only');
{
  const nb = table(namba), nbUp = table(nambaUp);
  writeFileSync('src/route/routes/namba-timetable.ts', `// 南海本線 堺〜難波の時刻表（scripts/timetable.ts が生成。手で直さない）
import type { ServiceSpec } from '../types';

type Id = 'local' | 'express' | 'airport' | 'limited' | 'southern';
/** 上り（堺 → 難波） */
export const NB: Record<Id, ServiceSpec['timetable']> = {
  local: ${nb.local},
  express: ${nb.express},
  airport: ${nb.airport},
  limited: ${nb.limited},
  southern: ${nb.southern},
};

/** 下り（難波 → 堺） */
export const NB_UP: Record<Id, ServiceSpec['timetable']> = {
  local: ${nbUp.local},
  express: ${nbUp.express},
  airport: ${nbUp.airport},
  limited: ${nbUp.limited},
  southern: ${nbUp.southern},
};
`);
}
if (nambaOnly) process.exit(0);
const dn = table(shiokaze), upT = table(shiokazeUp);
const body = (r: Record<string, string>) => `{
  local: ${r.local},
  express: ${r.express},
  airport: ${r.airport},
  limited: ${r.limited},
}`;
writeFileSync('src/route/routes/shiokaze-timetable.ts', `// 南海本線の時刻表（scripts/timetable.ts が生成。手で直さない）
import type { ServiceSpec } from '../types';

/** 下り（桜ヶ丘 → 岬口） */
export const TT: Record<'local' | 'express' | 'airport' | 'limited', ServiceSpec['timetable']> = ${body(dn)};

/** 上り（岬口 → 桜ヶ丘） */
export const TT_UP: Record<'local' | 'express' | 'airport' | 'limited', ServiceSpec['timetable']> = ${body(upT)};
`);

// 南海本線 泉大津〜岸和田（特急サザンを含む）
const kDn = table(kishiwada), kUp = table(kishiwadaUp);
const kBody = (r: Record<string, string>) => `{
  local: ${r.local},
  express: ${r.express},
  airport: ${r.airport},
  limited: ${r.limited},
  southern: ${r.southern},
}`;
writeFileSync('src/route/routes/kishiwada-timetable.ts', `// 南海本線 泉大津〜岸和田の時刻表（scripts/timetable.ts が生成。手で直さない）
import type { ServiceSpec } from '../types';

type Id = 'local' | 'express' | 'airport' | 'limited' | 'southern';
/** 下り（泉大津 → 岸和田） */
export const KT: Record<Id, ServiceSpec['timetable']> = ${kBody(kDn)};

/** 上り（岸和田 → 泉大津） */
export const KT_UP: Record<Id, ServiceSpec['timetable']> = ${kBody(kUp)};
`);

// 南海本線 堺〜岸和田（通し）。下り = 堺 → 岸和田（throughUp）、上り = 岸和田 → 堺（through）
const nDn = table(throughUp), nUp = table(through);
writeFileSync('src/route/routes/through-timetable.ts', `// 南海本線 堺〜岸和田（通し）の時刻表（scripts/timetable.ts が生成。手で直さない）
import type { ServiceSpec } from '../types';

type Id = 'local' | 'express' | 'airport' | 'limited' | 'southern';
/** 下り（堺 → 岸和田） */
export const NT: Record<Id, ServiceSpec['timetable']> = ${kBody(nDn)};

/** 上り（岸和田 → 堺） */
export const NT_UP: Record<Id, ServiceSpec['timetable']> = ${kBody(nUp)};
`);

// --shiokaze-only は南海本線だけ更新。別作業中の山岳線の生成物を触らない。
if (!process.argv.includes('--shiokaze-only')) {
const mDn = table(mountain), mUp = table(mountainUp);
writeFileSync('src/route/routes/mountain-timetable.ts', `// 高野線の時刻表（scripts/timetable.ts が生成。手で直さない）
import type { ServiceSpec } from '../types';

/** 下り（橋本 → 極楽橋） */
export const MT: Record<'local', ServiceSpec['timetable']> = {
  local: ${mDn.local},
};

/** 上り（極楽橋 → 橋本） */
export const MT_UP: Record<'local', ServiceSpec['timetable']> = {
  local: ${mUp.local},
};
`);
}
