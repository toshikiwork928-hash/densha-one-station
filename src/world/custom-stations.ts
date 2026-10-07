// 独自配置の駅（Station.layout = 'custom'）: Station.customPlatforms の島式・片面ホームを並べる（複々線の駅・高野線と並ぶ駅）。
// external のホームは専用モジュール（難波のターミナルなど）が描く。駅舎は高架下の簡易な箱（最初の片面ホームの側、無ければ左）
import * as THREE from 'three';
import type { GameContext } from '../core/context';
import type { Station } from '../route/types';
import { buildIsland, buildStation } from './stations';
import { GeoBatch, M, P } from './batch';
import { getTerrain } from './terrain';
import { trackSpan } from '../route/service';

export function buildCustomStation(ctx: GameContext, sta: Station, prev: string, next: string): void {
  const T = getTerrain(ctx), list = sta.customPlatforms ?? [];
  const sc = (sta.platform.from + sta.platform.to) / 2;
  const dy = sta.elevated ? T.groundY(sc) - T.trackY(sc) : 0;
  let main = true;
  for (const p of list) {
    if (p.external) continue;
    const st: Station = { ...sta, platform: { ...sta.platform, from: p.from ?? sta.platform.from, to: p.to ?? sta.platform.to } };
    if (p.kind === 'island') buildIsland(ctx, st, prev, next, p.lat, p.width, { stairs: true, roof: p.roof });
    else { buildStation(ctx, st, prev, next, { lat: p.lat, side: p.side, minimal: !main, elevatedDy: dy }); main = false; }
  }
  if (!sta.elevated || !main || list.every(p => p.external)) return;
  // 片面ホームが無い（島式だけの）高架駅: 高架下の改札・駅舎（線路の範囲の左外）
  const [lo] = trackSpan(ctx.route, sc), t = ctx.track.trackAt(sc), b = new GeoBatch();
  const grp = new THREE.Group(); grp.position.copy(ctx.track.at(sc, 0, 0)); grp.rotation.y = -t.phi; ctx.scene.add(grp);
  b.add('body', P.boxB, M(lo - 9, dy, 0, 0, 12, 6, 40), 0xe2ded4);
  b.add('body', P.box, M(lo - 15.05, dy + 2, 0, 0, .1, 3, 10), 0x2b343d);
  b.add('body', P.box, M(lo - 9, dy + 6.2, 0, 0, 12.4, .4, 40.4), 0x6b7680);
  b.build({ body: new THREE.MeshLambertMaterial({ vertexColors: true }) }, grp);
}
