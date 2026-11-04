// 実ダイヤの自列車（2026-11-05 のユーザー指定）。時間帯ごと・向きごと・種別ごとに、実際の列車を1本だけ決め、どのコース（区間）もその列車の時刻で走る。
// コースの分け方はゲームの容量のためで、なんば（または和歌山市・和歌山港、空港系統は関西空港）から通しで走る1本の列車を、区間ごとに遊ぶ形にする。
//   - 和歌山方面: なんば発。普通・急行・サザンは和歌山市（和歌山港）まで行く列車、空港急行・ラピートβは関西空港行
//   - なんば方面: 普通・急行・サザンは和歌山市・和歌山港発、空港急行・ラピートβは関西空港発
//   - 始発駅の発車が、時間帯の開始時刻（core/config.ts の START_CLOCK）の前後60分にあって、いちばん近い列車。無ければその時間帯は選べない
//   - ラピートは β だけ（α は堺・岸和田を通過するので使わない）
//   - 普通の待避: 選んだ普通を抜く格上の列車（区急・準急 < 急行・空港急行 < サザン・ラピート）を、発車順の入れ替わりから推定（通過時刻の無い駅は駅の並びで補間）
// 出力: src/data/real-diagram.json（route/real-diagram.ts が読む）。元データは鉄道運用Hub の平日時刻表（node_modules/.cache/unyohub。scripts/oncoming-meets.ts が取得、CC BY 4.0）
// 使い方: npm run real:diagram → npm run timetable -- --local-only → npm run oncoming:meets -- --timetable → verify:routes・verify:oncoming
import { readFileSync, writeFileSync } from 'node:fs';
import { START_CLOCK } from '../src/core/config';
import { ROUTES } from '../src/route';
import type { ServiceId, TimeOfDay } from '../src/route/types';

const CACHE = 'node_modules/.cache/unyohub', OUT = 'src/data/real-diagram.json';
const TODS: TimeOfDay[] = ['morning', 'noon', 'evening', 'night'];
const SOUTH_COURSES = ['namba', 'namba-up', 'shiokaze', 'shiokaze-up', 'kishiwada', 'kishiwada-up', 'nankai-through', 'nankai-through-up', 'izumisano', 'izumisano-up', 'izumisano-misaki', 'izumisano-misaki-up', 'misaki-wakayamako', 'misaki-wakayamako-up'];

const tt = JSON.parse(readFileSync(`${CACHE}/timetable.json`, 'utf8')), ri = JSON.parse(readFileSync(`${CACHE}/railroad_info.json`, 'utf8'));
/** 本線の駅（なんば方から）と和歌山港 */
const LINE: string[] = [...ri.lines.honsen.stations.map((s: { station_name: string }) => s.station_name), '和歌山港'];
const idx = (name: string) => LINE.indexOf(name === 'なんば' ? '難波' : name);
const sec = (hm: string) => { const [h, m] = hm.replace('|', '').split(':').map(Number); return h * 3600 + m * 60; };

type Dir = 'down' | 'up';
interface At { t: number; stop: boolean }
interface Train { no: string; type: string; svc: ServiceId | null; rank: number; dir: Dir; origin: string; dest: string; at: Map<number, At> }

const svcOf = (type: string): ServiceId | null => type === '普通' ? 'local' : type === '急行' ? 'express' : type === '空港急行' ? 'airport'
  : type.startsWith('サザン') ? 'southern' : type.startsWith('ラピートβ') ? 'limited' : null;
const rankOf = (type: string) => type === '普通' ? 0 : type === '区急' || type === '準急' ? 1 : type === '急行' || type === '空港急行' || type === '-急行-' ? 2 : /^(サザン|ラピート)/.test(type) ? 3 : -1;

/** 本線の列車（和歌山港線・空港線との直通はつなぐ）。駅は LINE の index、時刻は 0時からの秒 */
const trains: Train[] = [];
for (const [key, dir] of [['outbound_trains', 'down'], ['inbound_trains', 'up']] as const) {
  for (const [no, list] of Object.entries<any[]>(tt.honsen[key])) for (const tr of list) {
    if (tr.train_type === '回送') continue;
    const at = new Map<number, At>(), n = ri.lines.honsen.stations.length;
    (tr.departure_times as (string | null)[]).forEach((v, i) => {
      if (!v) return;
      const j = dir === 'down' ? i : n - 1 - i;
      at.set(j, { t: sec(v), stop: !v.startsWith('|') });
    });
    let origin = tr.starting_station as string;
    const prev = tr.previous_trains?.[0], next = tr.next_trains?.[0];
    let dest = LINE[dir === 'down' ? Math.max(...at.keys()) : Math.min(...at.keys())];
    // 和歌山港線との直通（和歌山港の時刻を足す）、空港線との直通（始発・行先だけ）
    const wk = (line: 'wakayamakosen', d: 'outbound_trains' | 'inbound_trains', num: string) => tt[line]?.[d]?.[num]?.[0];
    if (dir === 'down' && next?.line_id === 'wakayamakosen') { const w = wk('wakayamakosen', 'outbound_trains', next.train_number); if (w?.departure_times?.[1]) at.set(LINE.length - 1, { t: sec(w.departure_times[1]), stop: true }); dest = '和歌山港'; }
    if (dir === 'up' && prev?.line_id === 'wakayamakosen') { const w = wk('wakayamakosen', 'inbound_trains', prev.train_number); if (w?.departure_times?.[0]) at.set(LINE.length - 1, { t: sec(w.departure_times[0]), stop: true }); origin = '和歌山港'; }
    if (dir === 'down' && next?.line_id === 'kukosen') dest = '関西空港';
    if (dir === 'up' && prev?.line_id === 'kukosen') origin = '関西空港';
    trains.push({ no, type: tr.train_type, svc: svcOf(tr.train_type), rank: rankOf(tr.train_type), dir, origin, dest, at });
  }
}

/** 列車がその駅を通る時刻（時刻の無い通過駅は、前後の時刻のある駅から駅の並びで補間。走らない駅は null） */
function timeAt(tr: Train, i: number): number | null {
  const v = tr.at.get(i);
  if (v) return v.t;
  const ks = [...tr.at.keys()].sort((a, b) => a - b);
  const lo = ks.filter(k => k < i).at(-1), hi = ks.find(k => k > i);
  if (lo == null || hi == null) return null;
  const a = tr.at.get(lo)!.t, b = tr.at.get(hi)!.t;
  return a + (b - a) * (i - lo) / (hi - lo);
}
const originDep = (tr: Train) => tr.dir === 'down' ? tr.at.get(Math.min(...tr.at.keys()))!.t : tr.at.get(Math.max(...tr.at.keys()))!.t;

/** 時間帯・向き・種別の1本 */
function pick(tod: TimeOfDay, dir: Dir, svc: ServiceId): Train | null {
  const start = START_CLOCK[tod];
  const ok = (tr: Train) => {
    if (tr.dir !== dir || tr.svc !== svc) return false;
    const airportLine = svc === 'airport' || svc === 'limited';
    if (dir === 'down') return tr.origin === '難波' && (airportLine ? tr.dest === '関西空港' : tr.dest === '和歌山市' || tr.dest === '和歌山港');
    return tr.dest === '難波' && (airportLine ? tr.origin === '関西空港' : tr.origin === '和歌山市' || tr.origin === '和歌山港');
  };
  let best: Train | null = null, bd = Infinity;
  for (const tr of trains) if (ok(tr)) {
    const d = Math.abs(originDep(tr) - start);
    if (d <= 3600 && (d < bd || (d === bd && originDep(tr) > originDep(best!)))) { best = tr; bd = d; }
  }
  return best;
}

interface Entry { svc: ServiceId; no: string; to: string; origin: string; from: string; end: string; start: number; dep: Record<string, number>; arr: number }
const out: { source: string; license: string; revision: string; picks: Record<string, Record<string, string>>; routes: Record<string, Partial<Record<TimeOfDay, { trains: Entry[]; waits: [string, ServiceId][] }>>> } = {
  source: '鉄道運用Hub 南海電鉄 時刻表データ（https://unyohub.2pd.jp/railroad_nankai/ 、平日、2024-12-21 改正）。scripts/real-diagram.ts で作成',
  license: 'CC BY 4.0（出典: 鉄道運用Hub）', revision: '2024-12-21', picks: {}, routes: {},
};
const SVCS: ServiceId[] = ['local', 'express', 'airport', 'southern', 'limited'];
const fmt = (t: number) => `${Math.floor(t / 3600)}:${String(Math.floor(t / 60) % 60).padStart(2, '0')}`;
const picks: Record<string, Train | null> = {};
for (const tod of TODS) for (const dir of ['down', 'up'] as const) for (const svc of SVCS) {
  const tr = pick(tod, dir, svc);
  picks[`${tod}/${dir}/${svc}`] = tr;
  (out.picks[`${tod}/${dir}`] ??= {})[svc] = tr ? `${tr.no} ${tr.type} ${tr.origin} ${fmt(originDep(tr))}発 ${tr.dest}行` : 'なし';
}

for (const id of SOUTH_COURSES) {
  const route = ROUTES[id];
  if (!route) { console.warn(`ROUTES に ${id} が無い`); continue; }
  const names = route.stations.map(s => s.name), li = names.map(idx);
  if (li.some(i => i < 0)) { console.warn(`${id}: Hub に無い駅 ${names.filter((_, k) => li[k] < 0).join(',')}`); continue; }
  const dir: Dir = li[1] > li[0] ? 'down' : 'up';
  const have = new Set((route.services ?? []).map(v => v.id));
  out.routes[id] = {};
  for (const tod of TODS) {
    const list: Entry[] = [];
    let waits: [string, ServiceId][] = [];
    for (const svc of SVCS) {
      const tr = picks[`${tod}/${dir}/${svc}`];
      if (!tr || !have.has(svc)) continue;
      // コースの中の停車駅（ゲームの停車駅と実際の停車駅の両方）
      const game = route.services!.find(v => v.id === svc)!;
      const stops = names.map((_, k) => k).filter(k => tr.at.get(li[k])?.stop && game.stops.includes(k));
      if (stops.length < 2) continue;
      const a = stops[0], z = stops.at(-1)!, start = tr.at.get(li[a])!.t;
      const dep: Record<string, number> = {};
      for (const k of stops.slice(1, -1)) dep[names[k]] = tr.at.get(li[k])!.t - start;
      // 終着の到着: 列車の終点ならその時刻（Hub の値は到着）。途中駅なら発車の 30 秒前（待避で長く停まる駅は -1 = ゲームの最速で着く）
      const isEnd = (dir === 'down' ? Math.max(...tr.at.keys()) : Math.min(...tr.at.keys())) === li[z];
      let arr = tr.at.get(li[z])!.t - start - (isEnd ? 0 : 30);
      if (svc === 'local') {
        waits = overtakes(tr, route.stations.map(s => !!s.loop), li, stops, have);
        if (!isEnd && waits.some(([n]) => n === names[z])) arr = -1;
      }
      list.push({ svc, no: tr.no, to: tr.dest === '難波' ? 'なんば' : tr.dest, origin: tr.origin === '難波' ? 'なんば' : tr.origin, from: names[a], end: names[z], start, dep, arr });
    }
    out.routes[id][tod] = { trains: list, waits };
  }
}

/** 普通 L を抜く格上の列車と駅（コースの始発駅は除く。待避線の無い途中駅は、走行中の追い越しなどゲームで表せないので除く） */
function overtakes(L: Train, loops: boolean[], li: number[], stops: number[], have: Set<ServiceId>): [string, ServiceId][] {
  const found: { k: number; svc: ServiceId; t: number }[] = [];
  const names = li.map(i => LINE[i]).map(n => n === '難波' ? 'なんば' : n), last = li.length - 1;
  for (const T of trains) {
    if (T === L || T.dir !== L.dir || T.rank <= 0) continue;
    for (let s = 1; s < stops.length; s++) {
      const p = stops[s - 1], k = stops[s];
      const lp = L.at.get(li[p])!.t, lk = L.at.get(li[k])!.t, tp = timeAt(T, li[p]), tk = timeAt(T, li[k]);
      if (tp == null || tk == null) continue;
      // 前の停車駅では普通が先に出て、この駅では格上が先（同じ分は普通の後とみなす）
      if (tp > lp && tk <= lk && !(tp === lp && tk === lk)) {
        if (k !== last && !loops[k]) { console.log(`  ${L.no}: ${names[k]} は待避線が無いので除外（${T.no} ${T.type}）`); break; }
        let svc: ServiceId | null = T.rank === 1 ? 'express' : T.type === '空港急行' ? 'airport' : T.rank === 2 ? 'express' : T.type.startsWith('サザン') ? 'southern' : 'limited';
        if (!have.has(svc)) svc = svc === 'airport' ? 'express' : svc === 'express' ? 'airport' : svc === 'southern' ? 'limited' : 'southern';
        if (have.has(svc)) found.push({ k, svc, t: tk });
        break;
      }
    }
  }
  found.sort((a, b) => a.k - b.k || a.t - b.t);
  const w: [string, ServiceId][] = [];
  for (const f of found) if (!w.some(([n, s]) => n === names[f.k] && s === f.svc)) w.push([names[f.k], f.svc]);
  return w;
}

writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
for (const [k, v] of Object.entries(out.picks)) console.log(k, Object.entries(v).map(([s, x]) => `${s}: ${x}`).join(' / '));
for (const [id, r] of Object.entries(out.routes)) for (const [tod, x] of Object.entries(r))
  console.log(`${id} ${tod}: ${x!.trains.map(e => `${e.svc} ${e.no} ${e.from}${fmt(e.start)}→${e.end}`).join(', ')} | 待避 ${x!.waits.map(w => w.join(':')).join(' ') || 'なし'}`);
