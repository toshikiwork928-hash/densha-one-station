import * as THREE from 'three';
import type { GameContext } from '../core/context';
import { buildTrack } from '../route/track';
import { profileLat } from '../route/service';
import { izumisanoMisaki } from '../route/routes/izumisano-misaki';

export type AirportRailCorridor = { from: number; to: number; lat0: number; lat1: number; keepRoads: boolean };
const corridors = new WeakMap<GameContext, AirportRailCorridor[]>();
export const airportRailCorridors = (ctx: GameContext): AirportRailCorridor[] => corridors.get(ctx) ?? [];
export const setAirportRailCorridors = (ctx: GameContext, zones: AirportRailCorridor[]): void => { corridors.set(ctx, zones); };

type Path = (s: number, lateral: number, height: number) => THREE.Vector3;

/** 軌道の両端を結ぶ。高さの差を傾きに反映し、勾配でも桁の端を合わせる。 */
export function spanMatrix(a: THREE.Vector3, b: THREE.Vector3, width: number, height: number): THREE.Matrix4 {
  const d = b.clone().sub(a), len = d.length();
  const rot = new THREE.Euler(-Math.asin(d.y / len), Math.atan2(d.x, d.z), 0, 'YXZ');
  return new THREE.Matrix4().compose(a.clone().lerp(b, .5), new THREE.Quaternion().setFromEuler(rot),
    new THREE.Vector3(width, height, len + .015));
}

export class AirportParts {
  private parts = new Map<number, THREE.Matrix4[]>();
  span(a: THREE.Vector3, b: THREE.Vector3, width: number, height: number, color: number): void {
    let list = this.parts.get(color);
    if (!list) { list = []; this.parts.set(color, list); }
    list.push(spanMatrix(a, b, width, height));
  }
  draw(group: THREE.Object3D, name: string): void {
    const box = new THREE.BoxGeometry(1, 1, 1);
    for (const [color, matrices] of this.parts) {
      const mesh = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial({ color }), matrices.length);
      matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.computeBoundingSphere(); mesh.name = name; group.add(mesh);
    }
  }
}

/** 駅構内の追加線の端から、本線とJR線をそれぞれの進行方向へ延ばす。 */
export function buildAirportJunction(ctx: GameContext): void {
  const { route, track, scene } = ctx;
  const offset = route.stations.at(-3)!.platform.from;
  const main = buildTrack(izumisanoMisaki), join = 260;
  const origin = main.trackAt(join), anchor = track.trackAt(offset + join);
  const yaw = anchor.phi - origin.phi, c = Math.cos(yaw), sn = Math.sin(yaw);
  const world = (p: THREE.Vector3) => new THREE.Vector3(anchor.x + c * (p.x-origin.x) - sn * (p.z-origin.z),
    anchor.y + p.y-origin.y, anchor.z + sn * (p.x-origin.x) + c * (p.z-origin.z));
  const zones: AirportRailCorridor[] = [];
  corridors.set(ctx,zones);
  const samples = Array.from({length: 151}, (_,i) => {
    const s = offset - 300 + i*20;
    return {s, ...track.trackAt(s)};
  });
  const project = (p: THREE.Vector3) => {
    let nearest = samples[0], min = Infinity;
    for (const sample of samples) {
      const d = (sample.x-p.x)**2 + (sample.z-p.z)**2;
      if (d < min) { min=d; nearest=sample; }
    }
    const dx=p.x-nearest.x, dz=p.z-nearest.z;
    return {s: nearest.s+dx*Math.sin(nearest.phi)-dz*Math.cos(nearest.phi),
      l: dx*nearest.rx+dz*nearest.rz};
  };
  const build = (path: Path, from: number, to: number, side: number, name: string) => {
    for (let q=from; q<to; q+=30) {
      const a=project(path(q,0,0)), b=project(path(Math.min(to,q+30),0,0));
      if(Math.min(Math.abs(a.l),Math.abs(b.l))<700)
        zones.push({from:Math.min(a.s,b.s)-4,to:Math.max(a.s,b.s)+4,
          lat0:Math.min(a.l,b.l)-4,lat1:Math.max(a.l,b.l)+4,keepRoads:true});
    }
    for (let chunk = from; chunk < to; chunk += 240) {
      const parts = new AirportParts(), end = Math.min(to, chunk + 240);
      for (let s = chunk; s < end; s += 6) {
        const t = Math.min(s + 6, end), h = path(s, 0, 0).y;
        const strip = (l: number, y: number, w: number, d: number, color: number) =>
          parts.span(path(s,l,y),path(t,l,y),w,d,color);
        if (h > 1.1) {
          strip(0,-.55,4.5,1.1,0xaaa69e);
          strip(side*2.15,.42,.25,.84,0xbab7ad);
        }
        strip(0,.11,3.25,.22,0x827c70);
        for (const l of [-.535,.535]) strip(l,.31,.07,.14,0xb8bcc2);
        strip(0,5.72,.035,.035,0x34393a);
        for (let q = s; q < t; q += .75) parts.span(path(q,-1,.22),path(q,1,.22),.22,.14,0x665d54);
        if ((s-from)%42 === 0) {
          const l = side*2.08;
          parts.span(path(s,l,0),path(s,l,6.6),.2,.2,0x676d70);
          parts.span(path(s,l,6.45),path(s,0,6.45),.13,.14,0x676d70);
        }
        if ((s-from)%30 === 0 && h > 1.2) {
          const p = path(s,0,-1.05);
          parts.span(new THREE.Vector3(p.x,-.5,p.z),p,1.45,1.6,0xa7a69f);
        }
      }
      parts.draw(scene,name);
    }
  };
  // 南海本線の架線をまたぐ径間では、支点の間を鋼桁で結ぶ。
  const girders = new AirportParts();
  for (const base of [0,4]) {
    const profile = route.trackProfiles![String(base)];
    for (let q = 568; q < 650; q += 2) for (const edge of [-1.55,1.55]) {
      const point = (s: number) => track.at(offset+s, profileLat(profile,offset+s)+edge,-1.75);
      girders.span(point(q),point(q+2),.5,1.45,0x697e84);
    }
  }
  girders.draw(scene,'airport-flyover-girders');
  for (const side of [-1,1]) {
    const upper = izumisanoMisaki.trackProfiles!['4'];
    build((s,l,h) => world(main.at(s,l + (side < 0 ? 0 : profileLat(upper,s)),h)), join, 2800, side,'airport-mainline');
    const start = offset + 1380, lat = side < 0 ? -40 : -36;
    const jr = track.trackAt(start), p = track.at(start,lat,0);
    // 駅の接線から内陸へ緩く振り、合流点で位置・高さ・向きを一致させる。
    build((s,l,h) => {
      const bend = -.00014*s*s, slope = -.00028*s;
      const phi = jr.phi + Math.atan(slope);
      return new THREE.Vector3(p.x+Math.sin(jr.phi)*s+jr.rx*bend+Math.cos(phi)*l,
        h+Math.max(.12,p.y+Math.min(9,-s*.018)-Math.max(0,-s-660)*.022),p.z-Math.cos(jr.phi)*s+jr.rz*bend+Math.sin(phi)*l);
    }, -1920,0,side,'airport-jr-approach');
  }
}
