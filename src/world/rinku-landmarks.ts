// OSM の外形を駅中心・空港方面の線路軸に投影した座標 [前方, 右方]（m）。
import * as THREE from 'three';
import type { GameContext } from '../core/context';
import { GeoBatch, M, P } from './batch';
import { cullByDistance } from './cull';
import { getTerrain } from './terrain';

type Outline = [number, number][];
const mall: Outline = [[12,-389],[34,-438],[154,-425],[155,-374],[30,-372],[19,-341],[11,-312],[50,-319],[45,-91],[-10,-101],[-9,-164],[28,-164],[28,-182],[-18,-183],[-15,-307]];
const park: Outline = [[640,-63],[578,-72],[576,-88],[407,-72],[406,5],[428,4],[429,30],[271,38],[269,7],[327,-1],[325,-73],[230,-85],[231,-155],[321,-160],[341,-147],[360,-159],[345,-182],[347,-492],[659,-113],[659,-62]];
const lagoon: Outline = [[531,-197],[461,-181],[427,-222],[424,-254],[444,-282],[431,-343],[458,-352],[473,-314],[505,-296],[483,-232],[495,-210]];
// 関空連絡橋の両側で折れ曲がる埋立地の護岸（OSM way 131093981）。
const shore: Outline = [[200,1200],[201,884],[206,575],[458,284],[670,35],[671,-119],
  [178,-716],[194,-782],[223,-796],[205,-907],[177,-1089],[198,-1202]];

function footprint(group: THREE.Group, outline: Outline, height: number, base: number, roof: number, wall: number): void {
  const shape = new THREE.Shape(outline.map(([s, lat]) => new THREE.Vector2(lat, s)));
  const solid = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  solid.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(solid, [roof, wall].map(color => new THREE.MeshLambertMaterial({color})));
  mesh.position.y = base;
  group.add(mesh);
}

function ferrisWheel(group: THREE.Group): void {
  const wheel = new THREE.Group();
  wheel.name = 'rinku-seacle-wheel';
  wheel.position.set(-344, 43, -58);
  // OSM の観覧車の長軸は、駅の座標で前方57m・右方62m。
  wheel.rotation.y = Math.atan2(57, 62);
  const batch = new GeoBatch(), white = 0xe4e2d9;
  const beam = (a: THREE.Vector3, b: THREE.Vector3, width: number, color: number) => {
    const v = b.clone().sub(a);
    const matrix = new THREE.Matrix4().compose(a.clone().lerp(b, .5),
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize()),
      new THREE.Vector3(width, v.length(), width));
    batch.add('metal', P.box, matrix, color);
  };
  for (const z of [-2.5, 2.5]) {
    const hub = new THREE.Vector3(0, 0, z);
    for (const x of [-18, 18]) beam(new THREE.Vector3(x, -43, z * 3), hub, 1.8, white);
    const at = (i: number) => new THREE.Vector3(40 * Math.sin(i * Math.PI / 24), 40 * Math.cos(i * Math.PI / 24), z);
    for (let i = 0; i < 48; i++) {
      const p = at(i);
      beam(p, at(i + 1), .85, white);
      if (i % 2 === 0) beam(hub, p, .36, white);
      if (z > 0) {
        batch.add('metal', P.box, M(p.x, p.y - 1.1, 0, 0, 2.3, 2.2, 3.3), [0x557b90, 0x934c40, 0xa48a4f, 0x62866c][i % 4]);
      }
    }
  }
  batch.build({metal: new THREE.MeshLambertMaterial({vertexColors:true})}, wheel);
  group.add(wheel);
}

export function buildRinkuLandmarks(ctx: GameContext, s: number, group: THREE.Group): void {
  const t = ctx.track.trackAt(s);
  group.position.set(t.x, getTerrain(ctx).groundY(s), t.z);
  group.rotation.y = -t.phi;
  footprint(group, [...shore, [1350,-1202], [1350,1200]], .04, .03-group.position.y, 0x749ba9, 0x749ba9);
  const coping = new GeoBatch();
  for (let i = 1; i < shore.length; i++) {
    const [a,x] = shore[i-1], [b,y] = shore[i];
    const yaw = Math.atan2(y-x, a-b);
    coping.add('wall', P.box, M((x+y)/2, .35, -(a+b)/2, yaw, 2, .72, Math.hypot(y-x,b-a)), 0xaab2ae);
  }
  coping.build({wall: new THREE.MeshLambertMaterial({vertexColors:true})}, group);
  footprint(group, mall, 10, .08, 0xc2bbab, 0xaaa49d);
  footprint(group, park, .18, .04, 0x709169, 0x8e9185);
  footprint(group, lagoon, .1, .22, 0x6998a2, 0x9da79e);
  ferrisWheel(group);
  cullByDistance(ctx, group, 1800);
}
