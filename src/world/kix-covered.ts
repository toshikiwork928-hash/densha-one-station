import type { Route } from '../route/types';

/** 関西空港駅の掘割・道路ボックス・人工地盤下ホームの被覆区間。 */
export interface KixCoveredBox {
  from: number;
  to: number;
  left: number;
  right: number;
  ceiling: number;
}

/** 下り基準の区間を、reverseRoute 後は駅中心と横位置の鏡像へ変換する。 */
export function kixCoveredBoxes(route: Route): KixCoveredBox[] {
  if (!route.airportBridge) return [];
  const sta = route.stations.find(s => s.name === '関西空港');
  if (!sta) return [];
  const c = (sta.platform.from + sta.platform.to) / 2;
  const reversed = !!route.airportBridge.islandAtStart;
  const left = reversed ? 4 - 26 : -17;
  const right = reversed ? 4 - (-17) : 26;
  const span = (a: number, b: number, ceiling: number): KixCoveredBox => ({
    from: c + (reversed ? -b : a),
    to: c + (reversed ? -a : b), left, right, ceiling,
  });
  return [span(-720, -540, 6.15), span(-180, 130, 6.8)];
}
