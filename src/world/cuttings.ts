// 切土の擁壁（route.cuttings）: 線路の脇にコンクリートの壁と、その上の草の法面を作る。山あいの区間で、線路が周囲の地面より低い所。
// 壁は最も外側の線路から offset の位置に立て、s 方向に 3m ごとの継ぎ目と、水抜きの穴の列を描く（色の濃淡と小さな箱）。
import * as THREE from 'three';
import type { GameContext } from '../core/context';
import { trackSpan } from '../route/service';
import { GeoBatch, M, P } from './batch';
import { cullByDistance } from './cull';
import { getTerrain, gridAlong } from './terrain';

// 擁壁の色は、照明で暗く見えるので明るめのコンクリート色にする（Lambert は法線が横を向くと昼でも暗い）
const WALL = new THREE.Color(0xe6e2d6), JOINT = new THREE.Color(0xb3ae9e), GRASS = new THREE.Color(0x6a9a4c);
export const CUTTING_BANK_WIDTH = 22;

export function buildCuttings(ctx: GameContext): void {
  const { scene, track, route } = ctx, list = route.cuttings ?? [];
  if (!list.length) return;
  const T = getTerrain(ctx);
  const wallMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const bankMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  for (const c of list) {
    const off = c.offset ?? 6.5, h = c.height ?? 4.5;
    const latOf = (s: number) => { const [lo, hi] = trackSpan(route, s, 30); return c.side < 0 ? lo - off : hi + off; };
    const grp = new THREE.Group(); grp.name = `cutting-${c.from}`;
    // 擁壁の高さを両端から16 mかけて変化させる。
    const taper = (s: number) => Math.min(1, (s - c.from) / 16, (c.to - s) / 16);
    const crest = (s: number) => {
      const ground = T.terrainY(s, latOf(s));
      return ground + (T.trackY(s) + h - ground) * taper(s);
    };
    const base = (s: number) => Math.min(T.trackY(s), T.groundY(s)) - .3;
    // 壁面は 1.5m ごとに格子（継ぎ目の色）。s 方向 1.5m・縦 3 列で、継ぎ目の列だけ濃くする
    const wall = gridAlong(track, c.from, c.to, 1.5,
      s => { const y0 = base(s), y1 = crest(s), l = latOf(s); return [[l, y0], [l, y0 + (y1 - y0) * .33], [l, y0 + (y1 - y0) * .66], [l, y1]]; }, wallMat,
      (s, j, out) => { const u = ((s % 3) + 3) % 3; out.copy(WALL).lerp(JOINT, (u < .75 ? .55 : 0) + (j === 1 || j === 2 ? .18 : 0)); });
    // 草地は壁と同じ断面でつなぐ。両端では周囲の地表に戻し、外側にも裾を設ける。
    const bank = gridAlong(track, c.from, c.to, 1.5,
      s => {
        const l = latOf(s), t = taper(s);
        return [[0, 0], [3, .1], [10, 5], [16, 5], [CUTTING_BANK_WIDTH, 0]].map(([offset, rise]): [number, number] => {
          const lat = l + c.side * offset, ground = T.terrainY(s, lat);
          if (offset === 0) return [lat, crest(s)];
          const blend = t * Math.min(1, (CUTTING_BANK_WIDTH - offset) / (CUTTING_BANK_WIDTH - 10));
          return [lat, ground - .15 + (T.trackY(s) + h + rise - ground + .15) * blend];
        });
      }, bankMat,
      (s, j, out) => out.copy(GRASS).multiplyScalar(.85 + ((Math.floor(s / 6) * 7 + j * 3) % 5) * .05));
    grp.add(wall, bank);
    // 水抜きの穴（小さな暗い箱を 9m ごと・2段）
    const b = new GeoBatch();
    for (let s = c.from + 4; s < c.to - 4; s += 9) {
      const l = latOf(s), y0 = T.trackY(s), hh = crest(s) - y0;
      for (const yy of [.9, 2.3]) {
        if (yy > hh - .3) continue;
        const p = track.at(s, l + (c.side < 0 ? .08 : -.08), 0), t = track.trackAt(s);
        b.add('hole', P.box, M(p.x, y0 + yy, p.z, -t.phi, .5, .22, .22), 0x4a4944);
      }
    }
    b.build({ hole: new THREE.MeshLambertMaterial({ vertexColors: true }) }, grp);
    scene.add(grp);
    cullByDistance(ctx, grp, 900);
  }
}
