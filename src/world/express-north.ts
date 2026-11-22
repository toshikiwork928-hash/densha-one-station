// 北部区間の施設の中心・向き・低層棟の外形は沿線データ（© OpenStreetMap contributors）に合わせる。
import * as THREE from 'three';
import type { LandmarkModel, LandmarkSite } from './station-landmark';
import { basePart, GeoBatch, M, P } from './batch';

export const northSites: LandmarkSite[] = [
  { routeId: 'shiokaze', kind: 'sakai-hotel', s: 10704.3, lat: -128.7, angle: -5, width: 48, depth: 103 },
  { routeId: 'shiokaze', kind: 'sakai-platplat', s: 10812.1, lat: 68, angle: -5, width: 68, depth: 140 },
  { routeId: 'namba', kind: 'sakai-hotel', s: 112.1, lat: -128.8, angle: -1, width: 48, depth: 103 },
  { routeId: 'namba', kind: 'sakai-platplat', s: 208.6, lat: 75, angle: -1, width: 68, depth: 140 },
  { routeId: 'shiokaze', kind: 'takaishi-appla', s: 3261.8, lat: 104.6, angle: -10, width: 89, depth: 95 },
  { routeId: 'kishiwada', kind: 'kishiwada-keirin', s: 2923.5, lat: 107.6, angle: 0, width: 192, depth: 310, keepRoads: false },
];

function box(batch: GeoBatch, x: number, y: number, z: number, w: number, h: number, d: number, color: number) {
  batch.add('body', P.boxB, M(x, y, z, 0, w, h, d), color);
}

function sakaiHotel(b: GeoBatch): void {
  box(b, 0, 0, 0, 47.7, 15, 102.5, 0xc1b7aa);
  box(b, 0, 15, 0, 48, 1.1, 103, 0xd5cebf);
  box(b, 0, 16, 0, 33.4, 75, 56.4, 0xe2dbce);
  for (let y = 18; y < 90; y += 3.25) {
    box(b, 0, y, 0, 33.7, 1.4, 56.7, 0x587078);
  }
  for (const x of [-16.9, 16.9]) {
    for (let z = -26; z <= 27; z += 5.3) box(b, x, 16, z, .45, 75, .55, 0xdcd5cb);
  }
  box(b, 0, 91, 0, 34, 1.2, 57, 0xbcb8af);
  box(b, 0, 92.2, -3, 19, 3.7, 37, 0x9c9d98);
}

// 高架の外側に張り出す1番線に合わせ、東側へ12m寄せて棟の幅を68mに収める。
function platplat(b: GeoBatch): void {
  box(b, 0, 0, 0, 68, 12.5, 140, 0xd8d0c3);
  box(b, -34.1, 1, 0, .3, 6.7, 127, 0x66818c);
  // 上部の二層は開放式駐車場。柱の間から内部の暗がりが見える。
  box(b, 0, 12.5, 0, 64, 7.7, 136, 0x535b5d);
  for (const y of [12.5, 16.4, 20.3]) box(b, 0, y, 0, 68, 1, 140, 0xc8c4bb);
  for (const x of [-33, 33]) {
    for (let z = -67; z <= 67; z += 9.5) box(b, x, 12.5, z, .8, 8, 1, 0xdad6ca);
  }
  box(b, 0, 21.3, 0, 66.5, .12, 138.5, 0x777a78);
  for (let z = -61; z <= 62; z += 3.3) {
    for (const x of [-25, 25]) box(b, x, 21.44, z, 4.8, .05, .12, 0xdedcd2);
  }
}

function appla(b: GeoBatch): void {
  box(b, 0, 0, 0, 88, 10.6, 94.5, 0xdacbbb);
  box(b, 8, 10.6, -5, 64, 9, 75, 0xd1c6ba);
  box(b, 15, 19.6, -14, 39, 5, 44, 0xb5b0a7);
  box(b, -30, 10.6, 4, 26, 7.6, 66, 0x66838c);
  for (let z = -27; z <= 36; z += 6) box(b, -43.2, 10.6, z, .45, 7.6, .6, 0xd4d4cb);
  box(b, -30, 18.2, 4, 28, .65, 68, 0xd9d6c9);
  box(b, -43.8, 4.5, 2, 1.6, .6, 71, 0xc6b8a8);
}

/** 直線と半円を結んだ走路。曲線部の外縁を高くしてバンクをつける。 */
function keirin(b: GeoBatch): void {
  const innerRadius = (400 - 2 * 76) / (2 * Math.PI);
  const band = (offset: number, lift: number) => {
    const points: THREE.Vector3[] = [];
    for (const side of [1, -1]) {
      for (let i = 0; i <= 28; i++) {
        const a = (side === 1 ? -.5 : .5) * Math.PI + i * Math.PI / 28;
        const r = innerRadius + offset;
        points.push(new THREE.Vector3(side * 38 + r * Math.cos(a), lift * (.45 + .55 * Math.abs(Math.cos(a))), r * Math.sin(a)));
      }
    }
    return points;
  };
  const ring = (inner: THREE.Vector3[], outer: THREE.Vector3[], color: number) => {
    const vertices: number[] = [];
    for (let i = 0; i < inner.length; i++) {
      const j = (i + 1) % inner.length;
      for (const p of [inner[i], outer[j], outer[i], inner[i], inner[j], outer[j]]) vertices.push(p.x, p.y, p.z);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.computeVertexNormals();
    b.add('body', basePart(geo), M(0, .22, 0), color);
    geo.dispose();
  };
  const inside = band(-2, 0);
  box(b, 0, 0, 0, 179, .14, 161, 0xa8aa9e);
  ring(inside.map(() => new THREE.Vector3()), inside, 0x819958);
  ring(inside, band(0, .12), 0xbe7461);
  ring(band(0, .12), band(.26, .15), 0xf5eacf);
  ring(band(.26, .15), band(8.2, 3.8), 0x638da1);
  ring(band(8.2, 3.8), band(8.6, 3.9), 0xe8e4d3);
  ring(band(8.6, 3.9), band(9.4, 0), 0xadb5b0);
  // 大型映像装置をバンクの反対側に立てる。
  for (const x of [-4.5, 4.5]) box(b, x, 0, -52, .75, 4.3, .75, 0x838987);
  box(b, 0, 4.3, -52, 13.5, 6, 1.1, 0x5e676a);
  box(b, 0, 4.8, -51.4, 12.4, 5, .14, 0x34454c);
  // 線路側の外周と入場門。地上を走る電車からは照明塔とこの外周が先に見える。
  box(b, -88, 0, 18, .55, 2.1, 174, 0xc3c3ba);
  box(b, -88, 0, -98, .55, 2.1, 32, 0xc3c3ba);
  for (const z of [-81, -70]) box(b, -88, 0, z, 1.1, 4.7, 1, 0x989f9d);
  box(b, -88, 4.7, -75.5, 6, .85, 14, 0xc3c9c8);
  box(b, 0, 0, 62, 79, 12, 18, 0xb5b6b1);
  box(b, 0, 12, 59, 83, 1, 27, 0xe0dfd6);
  box(b, 0, 6, 52.8, 76, 4.2, .5, 0x4d6774);
  for (let x = -36; x <= 36; x += 6) box(b, x, 6, 52.5, .45, 4.2, .6, 0xbcc2bf);
  for (let row = 0; row < 5; row++) box(b, 0, 0, 49 + row, 77, 1.1 + row * .7, 1.2, 0x889da0);
  box(b, -57, 0, -58, 31, 5.2, 13, 0xcdcabe);
  box(b, -57, 5.2, -58, 32, .55, 14, 0xa1aaa4);
  for (const x of [-65, 65]) {
    for (const z of [-42, 42]) {
      box(b, x, 0, z, .95, 22, .95, 0x939997);
      box(b, x, 21.5, z, 5.8, 1.9, .8, 0xe4e1cc);
    }
  }
}

export const northModels: Record<string, LandmarkModel> = {
  'sakai-hotel': sakaiHotel,
  'sakai-platplat': platplat,
  'takaishi-appla': appla,
  'kishiwada-keirin': keirin,
};
