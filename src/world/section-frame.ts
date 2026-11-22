import type { Route } from '../route/types';

/** 走るコースとデータの共通の駅（駅名が一致するもの）。2つ未満ならそのデータは使わない。駅名だけで決まる（applyService の前後で変わらない） */
export function sharedStations(base: Route, route: Route) {
  const pairs = base.stations.map((st, i) => ({ st, j: route.stations.findIndex(x => x.name === st.name), i })).filter(p => p.j >= 0);
  return pairs.length >= 2 ? pairs : null;
}

/** 区間データを、上下線・通し運転のどちらでも同じ駅位置に合わせる。 */
export function sectionFrame(base: Route, route: Route) {
  const shared = sharedStations(base, route);
  if (!shared) return null;
  const center = (st: Route['stations'][number]) => (st.platform.from + st.platform.to) / 2;
  const pairs = shared.map(p => ({ b: center(p.st), j: p.j, i: p.i }));
  const rev = pairs[1].j < pairs[0].j;
  const B = pairs.map(p => p.b), Tt = pairs.map(p => {
    const station = route.stations[p.j];
    // 元データの自線側ホームは、逆向きのコースでは対向ホームに当たる。
    return center(station) + (rev ? station.platformOpp ?? 0 : 0);
  });
  const last = route.stations.length - 1;
  const atEnd = (j: number) => j === 0 || j === last;
  // データの範囲（データの座標）: 共通の駅の外側は、走るコースの端の駅なら全部、つなぎ目なら駅の中心まで
  const lo = atEnd(pairs[0].j) ? -Infinity : B[0], hi = atEnd(pairs[pairs.length - 1].j) ? Infinity : B[B.length - 1];
  const mapS = (sb: number) => {
    if (sb <= B[0]) return Tt[0] + (sb - B[0]) * (rev ? -1 : 1);
    for (let k = 0; k + 1 < B.length; k++) if (sb <= B[k + 1]) return Tt[k] + (Tt[k + 1] - Tt[k]) * (sb - B[k]) / (B[k + 1] - B[k]);
    return Tt[Tt.length - 1] + (sb - B[B.length - 1]) * (rev ? -1 : 1);
  };
  const C = Math.min(...base.tracks) + Math.max(...base.tracks);
  const mapL = (l: number) => rev ? C - l : l;
  const inR = (sb: number) => sb >= lo && sb <= hi;
  return { rev, lo, hi, mapS, mapL, inR };
}
