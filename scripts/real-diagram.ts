// 実ダイヤの自列車（docs/real-timetable/*.json の代表列車）から、ゲームが読む src/data/real-diagram.json を作る。
//   - trains: コース × 時間帯 × 種別の、自列車にする実際の1本（開始時刻の前後60分にあるものだけ）。区間の始発駅の発車時刻と、各停車駅の発車の差
//   - waits: 普通の待避・待ち合わせの駅と相手（代表の普通の overtakenBy から。始発駅の待ち・走行中の追い越し・推定の通過待ちは除く）
// 使い方: npm run real:diagram（docs/real-timetable を作り直したら流す）。出典は鉄道運用Hub（CC BY 4.0）
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { ROUTES } from '../src/route';
import type { ServiceId, TimeOfDay } from '../src/route/types';

const DIR = 'docs/real-timetable', OUT = 'src/data/real-diagram.json';
const TODS: TimeOfDay[] = ['morning', 'noon', 'evening', 'night'];

const sec = (hm: string) => { const [h, m] = hm.split(':').map(Number); return h * 3600 + m * 60; };

/** 列車がその駅を通る時刻 [s]。時刻の無い通過駅は、前後の時刻のある駅から駅の並びで補間。分からなければ 0 */
function timeAt(train: any, st: string): number {
  const ts: { st: string; dep?: string; arr?: string; pass?: string | null }[] = train?.times ?? [];
  const at = (x: typeof ts[number]) => { const v = x.dep ?? x.arr ?? x.pass; return v ? sec(v) : null; };
  const i = ts.findIndex(x => x.st === st);
  if (i < 0) return 0;
  const v = at(ts[i]);
  if (v != null) return v;
  let a = i - 1, b = i + 1;
  while (a >= 0 && at(ts[a]) == null) a--;
  while (b < ts.length && at(ts[b]) == null) b++;
  if (a < 0 || b >= ts.length) return a >= 0 ? at(ts[a])! : b < ts.length ? at(ts[b])! : 0;
  return at(ts[a])! + (at(ts[b])! - at(ts[a])!) * (i - a) / (b - a);
}

/** Hub の種別名 → ゲームの種別。route に無い種別は同じ格のものへ */
function svcOfType(type: string, have: Set<string>): ServiceId | null {
  let id: ServiceId | null = type.startsWith('空港急行') ? 'airport' : type.startsWith('急行') || type.startsWith('区急') || type.startsWith('準急') ? 'express'
    : type.startsWith('サザン') ? 'southern' : type.startsWith('ラピート') ? 'limited' : null;
  if (!id) return null;
  if (!have.has(id)) id = id === 'airport' ? 'express' : id === 'express' ? 'airport' : id === 'southern' ? 'limited' : 'southern';
  return have.has(id) ? id : null;
}

interface Entry { svc: ServiceId; no: string; to: string; from: string; end: string; start: number; dep: Record<string, number>; arr: number }
const out: { source: string; license: string; revision: string; routes: Record<string, Partial<Record<TimeOfDay, { trains: Entry[]; waits: [string, ServiceId][] }>>> } = {
  source: '鉄道運用Hub 南海電鉄 時刻表データ（https://unyohub.2pd.jp/railroad_nankai/ 、平日、2024-12-21 改正）。docs/real-timetable から scripts/real-diagram.ts で作成',
  license: 'CC BY 4.0（出典: 鉄道運用Hub）', revision: '2024-12-21', routes: {},
};

for (const f of readdirSync(DIR).filter(x => x.endsWith('.json') && x !== 'index.json')) {
  const c = JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')), id = f.replace(/\.json$/, ''), route = ROUTES[id];
  if (!route) { console.warn(`ROUTES に ${id} が無い`); continue; }
  const have = new Set((route.services ?? []).map(v => v.id as string));
  const names = route.stations.map(s => s.name);
  out.routes[id] = {};
  for (const tod of TODS) {
    const t = c.timeOfDay[tod];
    if (!t) continue;
    const trains: Entry[] = [];
    for (const [key, r] of Object.entries<any>(t.representatives)) {
      const svc = key.split('@')[0] as ServiceId;
      if (!r.inWindow || !have.has(svc)) continue;
      const [from, end] = (r.section as string).split(' → ').map(x => x.trim());
      if (!names.includes(from) || !names.includes(end)) { console.warn(`${id}/${tod}/${key}: 区間 ${r.section} の駅がコースに無い`); continue; }
      const start = sec(r.times[0].dep), dep: Record<string, number> = {};
      for (const x of r.times.slice(1)) if (x.dep && x.st !== end) dep[x.st] = sec(x.dep) - start;
      const arr = Math.round((r.vsGame?.realArrEstMin ?? 0) * 60);
      if (!arr) { console.warn(`${id}/${tod}/${key}: 終着の到着の推定が無い`); continue; }
      trains.push({ svc, no: r.train, to: r.to, from, end, start, dep, arr });
    }
    // 普通の待避（代表の普通）。始発駅の待ちは除く（ゲームは始発駅で待避しない）。終着駅の待ちは到着前の放送だけになる
    const waits: [string, ServiceId][] = [], order = new Map<string, number>();
    const lr = t.representatives.local;
    if (lr?.inWindow) for (const w of lr.overtakenBy ?? []) {
      if (w.atCourseOrigin || /推定|走行中|不明/.test(w.kind)) continue;
      const i = names.indexOf(w.at);
      if (i <= 0) continue;
      // 待避線の無い駅（4線区間の駅など）はゲームで待避を表現できない
      if (i < names.length - 1 && !route.stations[i].loop) { console.log(`${id}/${tod}: ${w.at} は待避線が無いので除外（${w.byType}）`); continue; }
      const by = svcOfType(w.byType, have);
      if (by && !waits.some(([n, b]) => n === w.at && b === by)) waits.push([w.at, by]);
      order.set(`${w.at}:${by}`, timeAt(t.trains.find((x: any) => x.train === w.by), w.at));
    }
    // 同じ駅で2本以上待つときは、相手が駅を通る順（通過時刻が無い駅は前後の時刻を駅の並びで補間）
    waits.sort((a, b) => names.indexOf(a[0]) - names.indexOf(b[0]) || (order.get(a.join(':')) ?? 0) - (order.get(b.join(':')) ?? 0));
    out.routes[id][tod] = { trains, waits };
  }
}
writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
for (const [id, r] of Object.entries(out.routes)) for (const [tod, x] of Object.entries(r))
  console.log(`${id} ${tod}: ${x!.trains.map(e => `${e.svc}${e.end !== names(id).at(-1) || e.from !== names(id)[0] ? `(${e.from}-${e.end})` : ''} ${e.no}`).join(', ')} | 待避 ${x!.waits.map(w => w.join(':')).join(' ') || 'なし'}`);
function names(id: string) { return ROUTES[id].stations.map(s => s.name); }
