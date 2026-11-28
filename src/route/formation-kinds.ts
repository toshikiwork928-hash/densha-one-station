import type { TrainKind } from './types';

/** 車種選択で使うユニット順。旧塗装7100系は4両1本、9000系の2両増結車は8300系。 */
export function playerFormationKinds(kind: TrainKind, units: readonly number[]): TrainKind[] {
  return units.map((cars, i) => {
    if (kind === 'commuter-7100-restored' && i > 0) return 'commuter-old';
    if (kind === 'commuter-9000' && units.length === 3 && cars === 2) return 'commuter-new';
    return kind;
  });
}
