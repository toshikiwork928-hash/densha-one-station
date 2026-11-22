import { GeoBatch, M, P } from './batch';
import type { LandmarkModel, LandmarkSite } from './station-landmark';

export const osakaSites: LandmarkSite[] = [
  { routeId: 'namba', kind: 'OMO7大阪', s: 8600.4, lat: 138.7, width: 111, depth: 44, angle: -34 },
  { routeId: 'namba', kind: 'カナートモール天下茶屋', s: 6931.1, lat: -72, width: 81, depth: 47, angle: -1 },
];

function boxFor(batch: GeoBatch) {
  return (x: number, y: number, z: number, width: number, height: number, depth: number, color: number, turn = 0) =>
    batch.add('body', P.box, M(x, y, z, turn, width, height, depth), color);
}

function buildShinImamiyaHotel(batch: GeoBatch): void {
  const box = boxFor(batch);
  // 高層棟の長辺は東西方向。JR 側の低層部にはテラスと植栽を置く。
  box(0, 3.5, 2, 110, 7, 25, 0x77766f);
  box(0, 34, 0, 107, 54, 19.4, 0x88999c);
  box(0, 61.2, 0, 109, .5, 21, 0xe2e1dc);
  box(0, 63.5, -2, 46, 4.4, 11, 0xb4b6b3);
  for (const side of [-1, 1]) {
    // 幅と折れ角の異なる白い膜を段ごとにずらし、間から客室の窓をのぞかせる。
    for (let tier = 0; tier < 4; tier++) {
      for (let bay = 0; bay < 9; bay++) {
        const fold = (bay + tier) % 3;
        box(-48 + bay * 12, 14 + tier * 13.4, side * 10.2, 10.3 + fold * .4,
          12.6, .22, [0xf2f1eb, 0xe3e5e1, 0xf8f7f0][fold], side * (.055 + fold * .035));
      }
    }
  }
  box(8, .55, 17, 86, 1.1, 10, 0x849c69);
  box(8, 1.15, 14, 86, .12, 2, 0xc0ae91);
  for (let x = -30; x <= 48; x += 13) {
    box(x, 2.1, 18, .55, 2.3, .55, 0x796b59);
    box(x, 3.8, 18, 3.8, 2.5, 3, 0x758d60);
  }
}

function buildTengachayaMall(batch: GeoBatch): void {
  const box = boxFor(batch);
  box(0, 4.35, 0, 76.4, 8.7, 46.4, 0xd6c5ac);
  box(0, 8.7, 0, 76.9, .55, 47, 0xe6e0d4);
  box(38.3, 2.1, 0, .3, 3.7, 42, 0x526970);
  box(38.9, 4.3, 0, 2.8, .5, 44, 0xc2b49c);
  for (let z = -20; z <= 20; z += 5) box(38.5, 2.1, z, .45, 4.1, .42, 0xd9d5cb);
  box(-9, 9.7, 5, 19, 1.5, 7, 0xadb2af);
}

export const osakaModels: Record<string, LandmarkModel> = {
  'OMO7大阪': buildShinImamiyaHotel,
  'カナートモール天下茶屋': buildTengachayaMall,
};
