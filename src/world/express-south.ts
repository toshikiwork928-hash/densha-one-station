// 南海本線の急行停車駅にある実在施設。正方向コースの座標だけを定義する。
// 施設名の看板は作らず、親の station-landmark が反転・接地・カリングする。
import type { LandmarkSite, LandmarkModel } from './station-landmark';
import { GeoBatch, M, P } from './batch';

// フェリー連絡通路の折れ点。OSM way 1531018072 の両側の縁の中点を投影した。
const ferryPath = [[15180.9, 44.1], [15181.9, 71.6], [15172.1, 95.9], [15205.3, 191.1]];
const ferryWalk: LandmarkSite[] = ferryPath.slice(1).map(([s, lat], i) => {
  const [prevS, prevLat] = ferryPath[i];
  return { routeId: 'misaki-wakayamako', kind: 'port-walk', s: (s + prevS) / 2, lat: (lat + prevLat) / 2,
    angle: -Math.atan2(s - prevS, lat - prevLat) * 180 / Math.PI, width: Math.hypot(s - prevS, lat - prevLat), depth: 4.4 };
});

/** 岸和田駅と泉佐野駅は独立コースの境界にあるため、両方の正方向行を持つ。 */
export const southSites: LandmarkSite[] = [
  { routeId: 'misaki-wakayamako', kind: 'port-ticket-hall', s: 15175.7, lat: 38.5, angle: 0, width: 26, depth: 17 },
  { routeId: 'misaki-wakayamako', kind: 'port-boarding-hall', s: 15213, lat: 199.4, angle: -31, width: 31, depth: 10 },
  ...ferryWalk,
  { routeId: 'kishiwada', kind: 'kishiwada-arcade', s: 5854, lat: 150, angle: 77, width: 10, depth: 265 },
  { routeId: 'izumisano', kind: 'kishiwada-arcade', s: 261, lat: 148, angle: 74, width: 10, depth: 265 },
  { routeId: 'izumisano', kind: 'izumisano-center-hotel', s: 8195, lat: -266, angle: -8, width: 50, depth: 34 },
  { routeId: 'izumisano-misaki', kind: 'izumisano-center-hotel', s: 249, lat: -268, angle: -10, width: 50, depth: 34 },
  { routeId: 'izumisano-misaki', kind: 'okuwa-ozaki', s: 8908.7, lat: -217.8, angle: 45, width: 139.1, depth: 126 },
];

function box(b: GeoBatch, x: number, y: number, z: number, w: number, h: number, d: number, color: number) {
  b.add('body', P.boxB, M(x, y, z, 0, w, h, d), color);
}

/** だんじりが通れる高さ10.6mのアーチ。通りの両端と柱の間から奥まで見通せる。 */
function kishiwadaArcade(b: GeoBatch, site: LandmarkSite): void {
  const width = site.width, depth = site.depth;
  const top = (x: number) => 10.6 - 2.1 * (2 * x / width) ** 2;
  for (let i = 0; i < 8; i++) {
    const x0 = width * (i / 8 - .5), x1 = x0 + width / 8;
    const rise = top(x1) - top(x0), slope = Math.atan2(rise, x1 - x0);
    b.add('body', P.box, M((x0 + x1) / 2, (top(x0) + top(x1)) / 2, 0, 0,
      Math.hypot(x1 - x0, rise) + .05, .18, depth, 0, slope), i === 3 || i === 4 ? 0xd5deda : 0xa1aeb1);
  }
  for (const x of [-width / 2, width / 2]) {
    box(b, x, 8.1, 0, .36, .6, depth, 0xa1a5a0);
    const spans = Math.ceil(depth / 11);
    for (let j = 0; j <= spans; j++) box(b, x, 0, (j / spans - .5) * (depth - 1), .25, 8.5, .32, 0xb3ada0);
  }
  for (const z of [-(depth / 2 - 1), depth / 2 - 1]) {
    box(b, 0, 7.9, z, width, .7, .55, 0x727f83);
  }
}

function izumisanoCenterHotel(b: GeoBatch, site: LandmarkSite): void {
  const w = site.width, d = site.depth;
  box(b, 0, 0, 0, w, 10, d, 0xb8bac0);
  const tw = w * .65, td = d * .79;
  box(b, 0, 10, 0, tw, 71, td, 0xcacdd1);
  // 施工者の外観写真に合わせ、縦の窓列を横桟で区切り、端部は屋上より高く立ち上げる。
  for (const side of [-1, 1]) {
    for (let bay = 0; bay < 9; bay++) {
      const z = td * ((bay + .5) / 9 - .5);
      box(b, side * (tw / 2 + .09), 11, z, .2, 68.5, td / 11, 0x435a70);
    }
    for (let floor = 0; floor < 15; floor++) {
      box(b, side * (tw / 2 + .23), 13 + floor * 4.45, 0, .15, .25, td, 0xacb1b6);
    }
  }
  box(b, 0, 10, -td * .44, tw + .8, 77, td * .12, 0xbec4ca);
  box(b, 0, 10, -td * .53, tw * .82, 84, td * .09, 0xcdd0d3);
}

function okuwaOzaki(b: GeoBatch, site: LandmarkSite): void {
  const w = site.width, d = site.depth;
  box(b, 0, 0, 0, w, 10.5, d, 0xe4dcca);
  for (const side of [-1, 1]) {
    box(b, side * (w / 2 + .05), 1.1, 0, .14, 3.4, d * .68, 0x6d8285);
    box(b, side * (w / 2 + .3), 4.6, 0, .9, .4, d * .73, 0xc9bdab);
  }
  box(b, 0, 9, 0, w + .4, .7, d + .4, 0xb46d5e);
  box(b, 0, 10.5, 0, w - 1, .18, d - 1, 0xb3b1a8);
  box(b, -w * .28, 10.7, d * .28, 11, 4.8, 6.5, 0xc79378);
}

export const southModels: Record<string, LandmarkModel> = {
  'port-ticket-hall': ferryHall,
  'port-boarding-hall': ferryHall,
  'port-walk': ferryWalkway,
  'kishiwada-arcade': kishiwadaArcade,
  'izumisano-center-hotel': izumisanoCenterHotel,
  'okuwa-ozaki': okuwaOzaki,
};

function ferryHall(b: GeoBatch, { width, depth }: LandmarkSite): void {
  box(b, 0, 0, 0, width, 7.4, depth, 0xdad8ca);
  box(b, 0, 4.4, 0, width + .15, 1.9, depth + .15, 0x597783);
  box(b, 0, 7.4, 0, width + .8, .45, depth + .8, 0xc9cabc);
}

function ferryWalkway(b: GeoBatch, { width, depth }: LandmarkSite): void {
  box(b, 0, 3.55, 0, width + .5, .5, depth, 0xa9aba4);
  box(b, 0, 4.05, 0, width + .5, 1, depth, 0xc7c6ba);
  box(b, 0, 5.05, 0, width + .3, 1.8, depth - .25, 0x789297);
  box(b, 0, 6.85, 0, width + .8, .35, depth + .5, 0xdedccd);
  const spans = Math.ceil(width / 15);
  for (let i = 0; i < spans; i++) {
    const x = width * ((i + .5) / spans - .5);
    box(b, x, 0, 0, .85, 3.55, 1.4, 0xa2a59e);
    box(b, x, 5.05, 0, .22, 1.8, depth, 0xc2c4bb);
  }
}
