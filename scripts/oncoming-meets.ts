// 対向列車のすれ違いのリストを、実際の平日ダイヤから作る（鉄道運用Hub の時刻表データ。運用表データは CC BY 4.0）。
// ゲームの各コース × 種別 × 時間帯について、ゲームと同じ開始時刻（core/config.ts の START_CLOCK）・同じ時刻表（applyService）で走ったときに、
// 実際のダイヤで出会う逆向きの列車を、すれ違う位置（コースの s）・種別・停車中の駅とともに求め、src/data/oncoming-meets.json に書く。
// 取得した時刻表そのものはリポジトリに入れない（node_modules/.cache/unyohub に一時保存）。
//   npm run oncoming:meets               … 取得（一時保存があれば使う）して作る
//   npm run oncoming:meets -- --refresh  … 取り直す
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { ROUTES } from '../src/route/index';
import { applyService } from '../src/route/service';
import { START_CLOCK } from '../src/core/config';
import type { Route, TimeOfDay } from '../src/route/types';

(globalThis as any).window = {};
const args = new Set(process.argv.slice(2));
const CACHE = 'node_modules/.cache/unyohub';
const API = 'https://unyohub.2pd.jp/api';

async function post(name: string, body: string): Promise<any> {
  const file = `${CACHE}/${name}.json`;
  if (existsSync(file) && !args.has('--refresh')) return JSON.parse(readFileSync(file, 'utf8'));
  const res = await fetch(`${API}/${name}.php`, {
    method: 'POST', body,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'densha-one-station oncoming builder (personal, non-commercial)' },
  });
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  const json = await res.json();
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(file, JSON.stringify(json));
  return json;
}

/** 種別の記号: L 普通 / E急行・E区急・E準急 急行系（表示名つき）/ A 空港急行 / S サザン / Ra ラピートα / Rb ラピートβ */
function kindOf(type: string): string | null {
  if (type === '普通') return 'L';
  if (type === '空港急行') return 'A';
  if (type.includes('サザン')) return 'S';
  if (type.includes('ラピートα')) return 'Ra';
  if (type.includes('ラピートβ')) return 'Rb';
  if (type === '急行' || type === '区急' || type === '準急') return 'E' + type;
  return null; // 回送など
}

/** 停車駅では発車の DWELL 秒前から停車しているとみなす */
const DWELL = 25;
interface Pt { km: number; t: number; stop: boolean }

async function main() {
  const ri = await post('railroad_info', 'railroad_id=nankai&last_modified_timestamp=0');
  const tt = (await post('timetable', 'railroad_id=nankai&diagram_revision=2024-12-21&timetable_id=weekday&last_modified_timestamp=0')).honsen;
  const NAMES: string[] = ri.lines.honsen.stations.map((s: { station_name: string }) => s.station_name);
  const N = NAMES.length;
  const nameOf = (s: string) => s === 'なんば' ? '難波' : s;
  // 駅の なんばからの距離 [km]（ゲームの路線データ。駅間は営業キロに合わせてある）
  const KM: Record<string, number> = {};
  { const r = ROUTES['namba'], sN = r.stations.at(-1)!.stopS; for (const s of r.stations) KM[nameOf(s.name)] = (sN - s.stopS) / 1000; }
  { const r = ROUTES['nankai-through-up'], s0 = r.stations[0].stopS; for (const s of r.stations) KM[s.name] ??= KM['堺'] + (s.stopS - s0) / 1000; }
  const tsec = (v: string | null) => { const m = v ? /(\d+):(\d+)/.exec(v) : null; return m ? +m[1] * 3600 + +m[2] * 60 : null; };
  const trains = (dir: 'inbound_trains' | 'outbound_trains') => {
    const out: { kind: string; pts: Pt[] }[] = [];
    for (const arr of Object.values<any[]>(tt[dir])) for (const tr of arr) {
      const kind = kindOf(tr.train_type);
      if (!kind) continue;
      const pts: Pt[] = [];
      tr.departure_times.forEach((v: string | null, j: number) => {
        const name = NAMES[dir === 'inbound_trains' ? N - 1 - j : j]; // 上りの並びは 和歌山市 → 難波
        const t = tsec(v);
        if (t != null && KM[name] != null) pts.push({ km: KM[name], t, stop: !String(v).startsWith('|') });
      });
      if (pts.length >= 2) out.push({ kind, pts: pts.sort((a, b) => a.t - b.t) });
    }
    return out;
  };
  const OUT = trains('outbound_trains'), IN = trains('inbound_trains');
  const posAt = (pts: Pt[], t: number): { km: number; stopped: boolean } | null => {
    if (t < pts[0].t - DWELL || t > pts.at(-1)!.t) return null;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], arr = p.t - (p.stop ? DWELL : 0);
      if (p.stop && t >= arr && t <= p.t) return { km: p.km, stopped: true };
      if (i && t < arr) { const a = pts[i - 1]; return { km: a.km + (p.km - a.km) * (t - a.t) / (arr - a.t), stopped: false }; }
    }
    return null;
  };
  /** km → コースの s（コースの駅で折れ線補間、端は外挿） */
  const sOf = (r: Route) => {
    const k = r.stations.map(s => KM[nameOf(s.name)]), s = r.stations.map(x => x.stopS), up = k[0] < k.at(-1)!;
    return (km: number) => {
      let i = 1;
      while (i < k.length - 1 && (up ? km > k[i] : km < k[i])) i++;
      return s[i - 1] + (s[i] - s[i - 1]) * (km - k[i - 1]) / (k[i] - k[i - 1]);
    };
  };
  const result: Record<string, Record<string, Record<string, [number, string, number][]>>> = {};
  for (const [id, r0] of Object.entries(ROUTES)) {
    if (r0.lineId !== 'shiokaze' || r0.singleTrack) continue;
    result[id] = {};
    for (const sv of r0.services ?? []) {
      result[id][sv.id] = {};
      for (const tod of ['morning', 'noon', 'evening', 'night'] as TimeOfDay[]) {
        const r = structuredClone(r0); r.timeOfDay = tod; applyService(r, sv.id);
        const T0 = START_CLOCK[tod], toS = sOf(r);
        // 自列車の位置（停車駅の着・発で折れ線。始発・終着は通過扱いでも点にする）
        const pp: Pt[] = [];
        r.stations.forEach((s, i) => {
          if (s.pass && i && i < r.stations.length - 1) return;
          const arr = T0 + s.scheduledArrival, km = KM[nameOf(s.name)];
          pp.push({ km, t: arr, stop: true });
          if (s.dwell) pp.push({ km, t: arr + s.dwell, stop: true });
        });
        const towardNamba = pp.at(-1)!.km < pp[0].km;
        const pAt = (t: number) => {
          for (let i = 1; i < pp.length; i++) if (t <= pp[i].t) { const a = pp[i - 1], b = pp[i]; return b.t === a.t ? a.km : a.km + (b.km - a.km) * (t - a.t) / (b.t - a.t); }
          return pp.at(-1)!.km;
        };
        const list: [number, string, number][] = [];
        for (const o of towardNamba ? OUT : IN) {
          let prev: number | null = null;
          for (let t = pp[0].t; t <= pp.at(-1)!.t; t += 2) {
            const q = posAt(o.pts, t);
            if (!q) { prev = null; continue; }
            const d = (q.km - pAt(t)) * (towardNamba ? -1 : 1);
            if (prev != null && prev > 0 && d <= 0) {
              const st = q.stopped ? r.stations.findIndex(s => KM[nameOf(s.name)] === q.km) : -1;
              list.push([Math.round(toS(q.km)), o.kind, st]);
              break;
            }
            prev = d;
          }
        }
        list.sort((a, b) => a[0] - b[0]);
        result[id][sv.id][tod] = list;
      }
    }
  }
  const out = {
    source: '南海電鉄の平日ダイヤ（鉄道運用Hub https://unyohub.2pd.jp/railroad_nankai/ の時刻表データ）から計算',
    /** [routeId][serviceId][timeOfDay] = [すれ違う位置 s, 種別の記号, 相手が停車中の駅 index（走行中は -1）] の並び（s の小さい順） */
    meets: result,
  };
  mkdirSync('src/data', { recursive: true });
  writeFileSync('src/data/oncoming-meets.json', JSON.stringify(out));
  let n = 0;
  for (const a of Object.values(result)) for (const b of Object.values(a)) for (const c of Object.values(b)) n += c.length;
  console.log(`src/data/oncoming-meets.json: ${n} 件、${(JSON.stringify(out).length / 1024).toFixed(0)} KB`);
}
main().catch(e => { console.error(e); process.exit(1); });
