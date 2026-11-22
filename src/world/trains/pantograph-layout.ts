import type { TrainKind } from '../../route/types';

// 難波方からの車順。N = 難波寄り、S = 和歌山市・極楽橋寄り、B = 両端、- = 搭載なし。
// 同じ形式に複数の組成がある場合は、両数ごとにゲームで描く代表編成を選ぶ。
const plans: Record<TrainKind, Record<number, string>> = {
  'commuter-new': { 4: 'S--N', 2: '-B' },
  'commuter-old': { 4: 'N--N', 2: 'N-' },
  'commuter-7100-restored': { 4: 'N--N' },
  'commuter-6300': { 6: 'N-N--N', 4: 'N--N', 2: 'N-' },
  'commuter-1000': { 6: 'B-B---', 4: 'B---', 2: 'B-' },
  'commuter-2000': { 4: 'B---', 2: 'B-' },
  'commuter-2300': { 2: 'SS' },
  'commuter-9000': { 6: '-B-B--', 4: '-B--' },
  'southern-10000': { 4: 'B-B-' },
  'southern-12000': { 4: 'S--N' },
  'limited-30000': { 4: 'B-B-' },
  limited: { 6: '-B--B-' },
};

// 車端から台枠中心までの距離は側面写真からの近似値 [m]。
const inset: Record<TrainKind, number> = {
  'commuter-new': 2.4, 'commuter-old': 3.5, 'commuter-7100-restored': 3.5,
  'commuter-6300': 3.0, 'commuter-1000': 2.55, 'commuter-2000': 2.6,
  'commuter-2300': 2.7, 'commuter-9000': 2.8, 'southern-10000': 2.8,
  'southern-12000': 2.1, 'limited-30000': 2.6, limited: 2.7,
};

/** 車体ローカル座標を返す。編成末尾の運転台付き車は、描画時に車体全体が反転する。 */
export function pantographPositions(kind: TrainKind, count: number, index: number, nambaFirst: boolean, bodyLength: number): number[] {
  const car = nambaFirst ? index : count - 1 - index;
  const mount = plans[kind][count]?.[car];
  const reversedCab = count > 1 && index === count - 1;
  const endInset = kind === 'commuter-2000' ? bodyLength * .18 : inset[kind];
  const namba = (bodyLength / 2 - endInset) * (nambaFirst !== reversedCab ? -1 : 1);
  if (mount === 'B') return [-Math.abs(namba), Math.abs(namba)];
  if (mount === 'N') return [namba];
  if (mount === 'S') return [-namba];
  return [];
}
