// ワールド構築の入口。生成順は ctx.rng の消費順に影響するので変えるときは注意
import type { GameContext } from '../core/context';
import { loadAllAssets } from './assets';
import { createOncoming, type OncomingSystem } from './oncoming';
import { buildBackdrop, buildEndBlock, placeScenery, prepareSceneryModels } from './scenery';
import { buildSigns } from './signs';
import { buildSignals } from './signals';
import { buildStations } from './stations';
import { buildTrackMesh } from './track-mesh';
import { buildTerrain } from './terrain';
import { buildStructures } from './structures';
import { buildCrossings } from './crossings';
import { buildTown } from './town-jp';
import { createCab } from './cab';
import { createPlayerTrain, type PlayerTrain } from './player-train';

export interface World {
  oncoming: OncomingSystem;
  player: PlayerTrain;
  /** 外部素材を読み込んで配置。戻り値 = 失敗件数 */
  loadAssets(): Promise<number>;
}

/** 同期部分（線路・山・標識・駅）を生成 */
export function buildWorld(ctx: GameContext): World {
  buildTerrain(ctx);
  buildTrackMesh(ctx);
  buildStructures(ctx);
  buildBackdrop(ctx);
  buildSigns(ctx);
  buildStations(ctx);
  buildEndBlock(ctx);
  const town = buildTown(ctx); // 独自乱数（ctx.rng 不使用）
  buildSignals(ctx); // [A] 閉そく信号機（rng 不使用）
  const oncoming = createOncoming(ctx);
  buildCrossings(ctx, oncoming);
  const player = createPlayerTrain(ctx);
  createCab(ctx);

  return {
    oncoming,
    player,
    async loadAssets() {
      const { loaded, failed, total } = await loadAllAssets((done, n) => ctx.events.emit('assetsProgress', { done, total: n }));
      placeScenery(ctx, prepareSceneryModels(loaded), town.trees);
      if (failed) console.warn(`素材 ${failed}/${total} 件の読込に失敗。簡易モデルで代替`);
      return failed;
    },
  };
}
