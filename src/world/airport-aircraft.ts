import * as THREE from 'three';
import type { GameContext } from '../core/context';
import { GeoBatch, M, P } from './batch';

// 機首はローカル座標の +Z を向く。翼端と尾翼は遠くからも輪郭が分かる形にする。
function airliner(material: THREE.Material): THREE.Group {
  const group = new THREE.Group(), batch = new GeoBatch();
  const ivory = 0xf4f2ed, blue = 0x276787, alloy = 0xbecad0;
  batch.add('skin', P.sphere, M(0, 0, 0, 0, 5.5, 5.7, 43), ivory);
  batch.add('skin', P.sphere, M(0, .85, 16.8, 0, 3.5, 1.6, 5.8), 0x315260);
  for (const side of [-1, 1]) {
    const x = (v: number) => side * v;
    batch.addTris('skin', [
      x(1.8),0,5, x(21),1.5,-8, x(20),1.5,-10,
      x(1.8),0,5, x(20),1.5,-10, x(1.8),0,-5,
      x(1),1,-12, x(8),2,-18, x(1),1,-17,
    ], alloy);
    batch.add('skin', P.sphere, M(x(7.4), -1.4, 1, 0, 2.5, 2.5, 6.2), ivory);
    batch.add('skin', P.sphere, M(x(7.4), -1.4, 3.35, 0, 1.7, 1.7, .75), 0x44525a);
    batch.add('skin', P.sphere, M(x(2.3), -2.6, -2, 0, 1, 1.7, 1.8), 0x354049);
  }
  batch.addTris('skin', [0,1,-10, 0,8.4,-17.8, 0,8.4,-20, 0,1,-10, 0,8.4,-20, 0,1,-18.5], blue);
  batch.build({ skin: material }, group);
  group.name = 'airport-airliner';
  return group;
}

/** 連絡橋から見える第1滑走路の北東端を、下りの線路座標で配置する。 */
export function buildAirportAircraft(ctx: GameContext, running: GameContext): void {
  const station = ctx.route.stations.find(st => st.name === '関西空港');
  if (!station) return;
  const center = (station.platform.from + station.platform.to) / 2;
  const t = ctx.track.trackAt(center);
  const northeast = new THREE.Vector3(-Math.sin(t.phi), 0, Math.cos(t.phi));
  // OSM の南海駅中心と滑走路 06R/24L の北東端との差を、滑走路の長手・横方向へ分解した距離。
  const threshold = ctx.track.at(center, -760, 0).addScaledVector(northeast, 1190);
  threshold.y = .35;
  const heading = Math.atan2(northeast.x, northeast.z);
  const runway = new THREE.Group(), pavement = new GeoBatch();
  runway.name = 'airport-runway';
  runway.position.copy(threshold);
  runway.rotation.y = heading;
  // 路肩は舗装と辺を共有する。遠方でも地表と白線がちらつかないよう深度に差を付ける。
  for (const side of [-1,1])
    pavement.add('surface', P.box, M(side * 62.5, -.1, -1750, 0, 65, .24, 3500), 0x87917b);
  pavement.add('surface', P.box, M(0, 0, -1750, 0, 60, .25, 3500), 0x565d60);
  for (let d = 40; d < 3500; d += 65)
    pavement.add('marking', P.box, M(0, .15, -d, 0, 1.2, .035, 30), 0xe3e4df);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++)
      pavement.add('marking', P.box, M(side * (4 + 3.6 * i), .15, -18, 0, 2, .035, 28), 0xe3e4df);
  }
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const asphalt = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  const paint = asphalt.clone();
  paint.polygonOffsetFactor = -2;
  paint.polygonOffsetUnits = -8;
  pavement.build({ surface: asphalt, marking: paint }, runway);
  const plane = airliner(material);
  ctx.scene.add(runway, plane);

  const bridge = running.route.airportBridge!;
  const inbound = !!bridge.islandAtStart;
  const viewingPoint = inbound ? bridge.from - 550 : bridge.to - 140;
  let shift = 35, scheduled = false;
  const update = (time: number) => {
    // 接近時の列車速度から見通しの開ける時刻を見積もる。停車中も機体は飛び続ける。
    const remaining = viewingPoint - running.state.train.s;
    if (remaining > 1600 || running.state.state === 'title') scheduled = false;
    if (!scheduled && running.state.state === 'run' && remaining > 0 && remaining <= 1600) {
      const travelTime = remaining / Math.max(16, running.state.train.v);
      shift = (inbound ? 149 : 51) - travelTime - time;
      scheduled = true;
    }
    // 滑走路上では停止してから向きを変え、空中の折り返しは霧の外側に置く。
    const phase = THREE.MathUtils.euclideanModulo(time + shift, 216);
    const departing = phase < 100;
    const seconds = departing ? phase : Math.max(0, 200 - phase);
    const groundRun = 35;
    const speed = 75;
    const airborne = Math.max(0, seconds - groundRun);
    const distance = seconds < groundRun
      ? -420 - speed * groundRun / 2 + speed * seconds ** 2 / (2 * groundRun)
      : -420 + airborne * speed;
    const slope = departing ? .105 : .063;
    const height = slope * speed * (airborne - 1 + Math.exp(-airborne));
    plane.position.copy(threshold).addScaledVector(northeast, distance);
    plane.position.y += height + 3.6;
    const pitch = departing ? -.09 : -.045;
    const turn = Math.PI * THREE.MathUtils.smoothstep(phase, 200, 216);
    const taxiOffset = departing ? 18 * (1 - THREE.MathUtils.smoothstep(seconds, 0, 16)) : 9 * (1 - Math.cos(turn));
    plane.position.x += taxiOffset * Math.cos(heading);
    plane.position.z -= taxiOffset * Math.sin(heading);
    plane.position.addScaledVector(northeast, -9 * Math.sin(turn));
    plane.rotation.set(pitch * THREE.MathUtils.smoothstep(seconds, groundRun - 3, groundRun + 2),
      heading + (departing ? 0 : Math.PI - turn), 0, 'YXZ');
  };
  update(0);
  ctx.events.on('frame', ({ time }) => update(time));
}
