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
import { buildCatenary } from './catenary';
import { buildCrossings } from './crossings';
import { buildTown } from './town-jp';
import { createCab } from './cab';
import { createPlayerTrain, type PlayerTrain } from './player-train';
import { createOvertaking } from './overtaking';
import { buildCoastalLandmarks } from './coastal-landmarks';
import { buildHagoromoTrain } from './hagoromo-train';
import { buildNambaTerminal } from './namba-terminal';
import { buildSuminoeDepot, buildSuminoeDepotTrains } from './suminoe-depot';
import { buildKoyaPlatforms, buildKoyaTraffic } from './koya-traffic';
import { buildNambaLandmarks } from './namba-landmarks';

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
  buildCoastalLandmarks(ctx);
  buildHagoromoTrain(ctx); // 羽衣3番線に停車中の 2300系（描画のみ）
  buildCatenary(ctx); // rng 不使用
  buildBackdrop(ctx);
  buildSigns(ctx);
  buildStations(ctx);
  buildEndBlock(ctx);
  const town = buildTown(ctx); // 独自乱数（ctx.rng 不使用）
  buildSignals(ctx); // [A] 閉そく信号機（rng 不使用）
  const oncoming = createOncoming(ctx);
  buildCrossings(ctx, oncoming);
  // 堺〜難波（route.id = 'namba'）専用。ctx.rng を消費しない（他の路線の生成順に影響しない）
  buildNambaTerminal(ctx);
  buildSuminoeDepot(ctx);
  buildSuminoeDepotTrains(ctx); // 留置の電車（描画のみ）
  buildNambaLandmarks(ctx);
  buildKoyaPlatforms(ctx);
  buildKoyaTraffic(ctx); // 高野線・汐見橋線の電車（描画のみ）
  const player = createPlayerTrain(ctx);
  createOvertaking(ctx); // [G] 待避の通過列車・待避線の先行普通
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
