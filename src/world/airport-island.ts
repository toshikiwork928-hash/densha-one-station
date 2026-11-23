// OSM way 131098515 の第1期島。駅中心からの [線路方向, 右方向] を直交座標で表す。
import * as THREE from 'three';
import type { GameContext } from '../core/context';

const outline = [[-1653,-1104],[-1675,-268],[-1175,238],[2692,247],
  [2693,-1002],[1700,-923],[-788,-926],[-1511,-1009]];
const islandMasks = new WeakMap<GameContext, (s: number, lat: number, margin: number) => boolean>();
export function airportWaterMask(ctx: GameContext) { return islandMasks.get(ctx); }

export function airportIslandTerrain(ctx: GameContext) {
  const bridge = ctx.route.airportBridge;
  const station = ctx.route.stations.find(st => st.name === '関西空港');
  if (!bridge || !station) return;
  const center = (station.platform.from + station.platform.to) / 2;
  const t = ctx.track.trackAt(center), reversed = !!bridge.islandAtStart;
  const origin = ctx.track.at(center, reversed ? 4 : 0, 0);
  const phi = t.phi + (reversed ? Math.PI : 0);
  const dx = Math.sin(phi), dz = -Math.cos(phi);
  // ゲームの線形に合わせ、北東端の護岸を連絡橋の島側橋台まで延ばす。
  const shoreS = reversed ? bridge.from : bridge.to;
  const shore = ctx.track.at(shoreS, 2, 0).sub(origin);
  const landing = dx * shore.x + dz * shore.z;
  const shoreLat = -dz * shore.x + dx * shore.z;
  const plan = outline.map(([s,l],i) => new THREE.Vector2(l, i < 2 ? landing : s));
  plan.splice(1, 0, new THREE.Vector2(shoreLat, landing));
  const group = new THREE.Group();
  group.position.set(origin.x, -.09, origin.z);
  group.rotation.y = -phi;
  const bay = new THREE.Mesh(new THREE.PlaneGeometry(7200, 10000).rotateX(-Math.PI / 2),
    new THREE.MeshPhongMaterial({color:0x749ba9, shininess:55}));
  bay.position.set(1900, -.53, 0);
  bay.name = 'airport-island-sea';
  group.add(bay);
  const shape = new THREE.Shape(plan);
  const island = new THREE.Mesh(new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({color:0x97998a, side:THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 4}));
  island.name = 'airport-island-ground';
  group.add(island);
  const concrete = new THREE.MeshLambertMaterial({color:0x9a9f9b});
  for (let i = 0; i < plan.length; i++) {
    const a = plan[i], b = plan[(i+1) % plan.length];
    const wall = new THREE.Mesh(new THREE.BoxGeometry(2, 2.3, a.distanceTo(b)), concrete);
    wall.rotation.y = Math.atan2(b.x-a.x, a.y-b.y);
    wall.position.set((a.x+b.x)/2, -.8, -(a.y+b.y)/2);
    wall.name = 'airport-island-seawall';
    group.add(wall);
  }
  ctx.scene.add(group);
  const coast = plan.map(p => ({x:origin.x + p.y*dx - p.x*dz, z:origin.z + p.y*dz + p.x*dx}));
  const onIslandSide = (s: number) => reversed ? s <= shoreS : s >= shoreS;
  islandMasks.set(ctx, (s, lat, margin) => {
    if (!onIslandSide(s)) return false;
    const p = ctx.track.at(s,lat,0);
    let inside = false;
    for (let i = 0; i < coast.length; i++) {
      const a = coast[i], b = coast[(i+1)%coast.length];
      if ((a.z > p.z) !== (b.z > p.z) && p.x < a.x + (p.z-a.z)*(b.x-a.x)/(b.z-a.z)) inside = !inside;
      const x = b.x-a.x, z = b.z-a.z;
      const f = THREE.MathUtils.clamp(((p.x-a.x)*x+(p.z-a.z)*z)/(x*x+z*z || 1),0,1);
      if ((p.x-a.x-f*x)**2 + (p.z-a.z-f*z)**2 < margin**2) return true;
    }
    return !inside;
  });
  // 列車・市街地と同じ高さの地面を護岸で切り、遠方は島全体の面で補う。
  return (s: number, row: [number,number][]): [number,number][] => {
    if (!onIslandSide(s)) return row;
    const t = ctx.track.trackAt(s);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < coast.length; i++) {
      const a = coast[i], b = coast[(i+1)%coast.length];
      const alongA = (a.x-t.x)*t.rz - (a.z-t.z)*t.rx;
      const alongB = (b.x-t.x)*t.rz - (b.z-t.z)*t.rx;
      if ((alongA > 0) === (alongB > 0)) continue;
      const f = alongA/(alongA-alongB);
      const lat = (a.x+(b.x-a.x)*f-t.x)*t.rx + (a.z+(b.z-a.z)*f-t.z)*t.rz;
      lo = Math.min(lo,lat); hi = Math.max(hi,lat);
    }
    if (hi < lo) return row.map(() => [0, -4]);
    return row.map(([l,y]) => {
      const lat = THREE.MathUtils.clamp(l,lo,hi);
      const ramp = THREE.MathUtils.smoothstep(Math.min(lat-lo,hi-lat),0,22)
        * (1 - THREE.MathUtils.smoothstep(Math.abs(lat), 370, 580));
      return [lat, -.09 + (y + .09)*ramp];
    });
  };
}
