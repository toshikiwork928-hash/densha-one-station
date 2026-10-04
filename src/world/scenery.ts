// 沿線景観: 遠景の山・終端の構造物（同期生成）と、読込素材（木・市街地のビル）の配置
// 住宅・商店などの近景は town-jp.ts（手続き生成）
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GameContext } from '../core/context';
import { fallbackBox, fallbackTree, prepareModel, type LoadedAssets, type PreparedModel } from './assets';
import { buildSceneryBatches, type SceneryItem } from './scenery-batch';
import { getTerrain } from './terrain';
import type { TreeSpot } from './town-jp';

/** 景観カテゴリ別のモデル集合 */
export interface SceneryModels {
  city: PreparedModel[];
  far: PreparedModel[];
  mid: PreparedModel[];
  trees: PreparedModel[];
  bushes: PreparedModel[];
}

// 1単位あたりの実寸 [m]（素材キットごとの縮尺合わせ）
export const KIT_SCALE: Record<keyof SceneryModels, number> = { city: 9, far: 9, mid: 2.6, trees: 3.4, bushes: 2.2 };

/** 遠景の山（ctx.rng を消費するため生成順を変えないこと） */
export function buildBackdrop(ctx: GameContext): void {
  const { scene, rng: rnd, track: { at }, route } = ctx;
  const mMat = new THREE.MeshLambertMaterial({ color: 0x6e8a7a, flatShading: true });
  const S0 = route.extent.from, S1 = route.extent.to;
  const geos: THREE.BufferGeometry[] = [];
  for (let s = S0 + 600, j = 0; s < S1 + 400; s += 420, j++) {
    const g = new THREE.ConeGeometry(260 + rnd() * 300, 140 + rnd() * 180, 6);
    const p = at(s, (j % 2 ? 1 : -1) * (1100 + rnd() * 500), 0);
    geos.push(g.translate(p.x, 60, p.z));
  }
  // 進行方向の遠景
  for (let j = 0; j < 5; j++) {
    const g = new THREE.ConeGeometry(400 + rnd() * 300, 200 + rnd() * 200, 6);
    const p = at(S1 + 1000 + rnd() * 600, (j - 2) * 700, 0); geos.push(g.translate(p.x, 80, p.z));
  }
  // 1メッシュへ結合（描画コール削減）
  const m = new THREE.Mesh(mergeGeometries(geos), mMat); m.name = 'backdrop'; scene.add(m);
}

/** 車止め先の遠方構造物（終端を隠す） */
export function buildEndBlock(ctx: GameContext): void {
  const s = ctx.route.scenery.endBlockS;
  if (s == null) return;
  const b = new THREE.Mesh(new THREE.BoxGeometry(60, 30, 20), new THREE.MeshLambertMaterial({ color: 0x8b97a3 }));
  const p = ctx.track.at(s, 0, 0); b.position.set(p.x, 15 + p.y, p.z); b.rotation.y = -ctx.track.trackAt(s).phi; ctx.scene.add(b);
}

/** 読込結果から景観モデルを用意（失敗カテゴリは代替） */
export function prepareSceneryModels(loaded: LoadedAssets): SceneryModels {
  const p = (k: keyof SceneryModels) => (loaded[k] ?? []).map(g => prepareModel(g.scene, k === 'trees' ? 'tree' : k === 'bushes' ? 'bush' : undefined));
  const M: SceneryModels = { city: p('city'), far: p('far'), mid: p('mid'), trees: p('trees'), bushes: p('bushes') };
  if (!M.city.length) M.city = [fallbackBox(0xb9c1c9)];
  if (!M.far.length) M.far = [fallbackBox(0x9fa8b3)];
  if (!M.mid.length) M.mid = M.city;
  if (!M.trees.length) M.trees = [fallbackTree()];
  if (!M.bushes.length) M.bushes = M.trees;
  return M;
}

// 沿線に配置。各カテゴリはモデル配列からランダムに選ぶ
export function placeScenery(ctx: GameContext, M: SceneryModels, spots: TreeSpot[] = []): void {
  const { rng: rnd, route, track: { trackAt } } = ctx, T = getTerrain(ctx);
  const TS0 = route.extent.from, TS1 = route.extent.to;
  const L0 = Math.min(...route.tracks), L1 = Math.max(...route.tracks);
  const latOf = (sd: number, d: number) => sd < 0 ? L0 - d : L1 + d;
  // 配置を集めて材質ごとの BatchedMesh へ（scenery-batch.ts）
  const items: SceneryItem[] = [];
  const put = (model: PreparedModel, s: number, lat: number, yaw: number, k: number, y?: number) => {
    const t = trackAt(s);
    items.push({ model, pl: { p: new THREE.Vector3(t.x + t.rx * lat, y ?? T.groundY(s), t.z + t.rz * lat), yaw: -t.phi + yaw, k } });
  };
  const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
  const facing = (side: number) => (side < 0 ? Math.PI / 2 : -Math.PI / 2) + (rnd() < .3 ? Math.PI : 0);
  const nearCity = (s: number, m: number) => route.scenery.cityZones.some(z => s > z.from - m && s < z.to + m);
  const blocked = (s: number) => T.nearCrossing(s, 3) || T.structureAt(s, 60)?.kind === 'tunnel' || T.groundY(s) < -.3;

  for (const side of [-1, 1]) {
    // 市街地の奥: 商業ビル・中層ビル
    for (let s = TS0; s < TS1;) {
      if (!T.isCity(s) || blocked(s)) { s += 10; continue; }
      const mid = rnd() < .4, model = pick(mid ? M.mid : M.city), k = mid ? KIT_SCALE.mid : KIT_SCALE.city;
      const half = Math.max(model.size.x, model.size.z) * k / 2;
      put(model, s, latOf(side, 70 + half + rnd() * 10), facing(side), k);
      s += half * 2 + 3 + rnd() * 6;
    }
    // 遠景: 簡易ビル群（市街地付近のみ）
    for (let s = TS0; s < TS1 + 400;) {
      if (!nearCity(s, 250) || blocked(s)) { s += 20; continue; }
      put(pick(M.far), s, latOf(side, 100 + rnd() * 140), rnd() * 6, KIT_SCALE.far * (1 + rnd() * .5));
      s += 12 + rnd() * 25;
    }
    // 線路際の木・植え込み（柵と道路の間）
    for (let s = TS0; s < TS1; s += 5 + rnd() * 16) {
      if (rnd() < .5 || blocked(s) || T.structureAt(s, 5) || T.nearStation(s, 10)) continue;
      const big = rnd() < .35;
      const model = pick(big ? M.trees : M.bushes), k = (big ? KIT_SCALE.trees * .8 : KIT_SCALE.bushes) * (.7 + rnd() * .4);
      put(model, s, latOf(side, 8.6 + rnd() * 1.4), rnd() * 6, k);
    }
  }
  // 街並み側が決めた木（庭木・屋敷林・山林）
  for (const t of spots) {
    const model = t.small ? pick(rnd() < .5 ? M.bushes : M.trees) : pick(M.trees);
    put(model, t.s, t.lat, rnd() * 6, (t.small ? KIT_SCALE.bushes * 1.3 : KIT_SCALE.trees) * t.k, t.y);
  }
  buildSceneryBatches(ctx, items);
}
