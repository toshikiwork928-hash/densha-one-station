// みさき公園駅の 5番線（多奈川線）に停まっている 7100系 2両（ワンマン、多奈川行き。描画のみ）。車両生成は DOM を使うので、world/index.ts からだけ呼ぶ（建築限界検査には含めない）。
// 人は乗せない。多奈川線の列車の運転はしない（このコースは本線の運転だけ）。駅の形は route/routes/misaki-park.ts、駅舎は world/misaki-park.ts。
import * as THREE from 'three';
import type { GameContext } from '../core/context';
import { profileLat } from '../route/service';
import { onLight } from './batch';
import { cullByDistance } from './cull';
import { placeCar } from './emu';
import { isMisakiPark } from './misaki-park';
import { bogieOffset, createTrainSet, setTrainNight } from './train-models';

/** 先頭は多奈川線の側（本線の分岐の側）。ホームの多奈川線寄りの端に停める */
export function buildMisakiParkTrain(ctx: GameContext): void {
  const { route, track } = ctx;
  const sta = route.stations.find(isMisakiPark), x = route.extraTracks?.find(e => e.id === 'misaki-t5');
  if (!sta || !x || !x.bumpers?.length) return;
  const sc = (sta.platform.from + sta.platform.to) / 2, far = x.bumpers[0];
  const dir = far > sc ? 1 : -1; // 先頭の向き（多奈川線の車止めの側）
  const cars = createTrainSet('commuter-old', 2, ctx.renderer, { dest: '多奈川', label: '普通', units: [2] });
  const group = new THREE.Group(); group.name = 'misaki-park-parked';
  const a = new THREE.Vector3(), z = new THREE.Vector3();
  // 先頭をホームの多奈川線寄りの端の 10m 手前に置き、最後尾へ連ねる
  let head = (dir > 0 ? sta.platform.to : sta.platform.from) - dir * 10;
  const isl = (sta.customPlatforms ?? []).filter(p => p.kind === 'island').map(p => p.lat);
  for (const c of cars) {
    const mid = head - dir * c.length / 2, bog = bogieOffset(c.length);
    const lat = (q: number) => profileLat(x.lat, q);
    a.copy(track.at(mid + dir * bog, lat(mid + dir * bog), .38)); z.copy(track.at(mid - dir * bog, lat(mid - dir * bog), .38));
    placeCar(c.object, a, z); group.add(c.object);
    // ドアは島式ホーム（5番線のとなり）の側だけ開ける。進行方向（dir）に対する左右
    const platLat = isl.reduce((best, q) => Math.abs(q - lat(mid)) < Math.abs(best - lat(mid)) ? q : best, isl[0]);
    c.setDoors(true, (platLat - lat(mid)) * dir > 0 ? 'R' : 'L');
    head -= dir * c.length;
  }
  onLight(ctx, (n, t) => setTrainNight(Math.max(n, t)));
  ctx.scene.add(group); cullByDistance(ctx, group, 500);
}
