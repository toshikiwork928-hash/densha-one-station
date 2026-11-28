import type { GameContext } from '../core/context';
import type { TrainKind } from '../route/types';

const restored: TrainKind = 'commuter-7100-restored';
const standard: TrainKind = 'commuter-old';

/** 7169編成の割当は1回の運転で共有する。画面から消えても同じ列車に保持する。 */
export function createTrafficLivery(ctx: GameContext) {
  let owner: string | undefined;
  ctx.events.on('reset', () => { owner = undefined; });
  return (kind: TrainKind, units: number[], unitKinds?: TrainKind[], trainId?: string) => {
    const kinds = unitKinds ?? [kind];
    if (!kinds.includes(standard) && !kinds.includes(restored)) return { kind, unitKinds };
    const player = ctx.service;
    const playerHasRestored = player && (player.unitKinds ?? [player.kind]).includes(restored);
    const eligible = units.findIndex((cars, i) => {
      const k = unitKinds?.[i] ?? kind;
      return cars === 4 && (k === standard || k === restored);
    });
    const allocate = trainId !== undefined && !playerHasRestored && eligible >= 0 && (owner === undefined || owner === trainId);
    if (!allocate && !kinds.includes(restored)) return { kind, unitKinds };
    if (allocate) owner = trainId;
    const assigned = units.map((_, i) => {
      const k = unitKinds?.[i] ?? kind;
      if (allocate && i === eligible) return restored;
      return k === restored ? standard : k;
    });
    return { kind: assigned[0], unitKinds: assigned };
  };
}

export type TrafficLivery = ReturnType<typeof createTrafficLivery>;
