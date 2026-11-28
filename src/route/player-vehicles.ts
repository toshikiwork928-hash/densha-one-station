// プレイヤー用の車両候補と保存値を路線データへ反映する。
import { carsOf, defaultVehicleOf, fitsEightCars } from './service';
import type { Route, ServiceId, ServiceSpec, TrainKind } from './types';
import { front7169ForRoute } from './vehicle-direction';
import { playerFormationKinds } from './formation-kinds';
export { playerFormationKinds };

export interface PlayerVehicleSelection {
  kind: TrainKind;
  freeKind?: TrainKind;
  /** 車種選択で表示する順序。混結は選んだ形式のユニットが先頭。 */
  units?: number[];
  cars?: number;
}

export interface PlayerVehicleOptions {
  kinds: TrainKind[];
  formations: number[][];
  freeKinds?: TrainKind[];
  platformLimit?: boolean;
}

const addUnique = <T>(base: T[], ...values: T[]): T[] => [...base, ...values.filter(v => !base.includes(v))];
const sameUnits = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((n, i) => n === b[i]);

export function selectedVehicleKind(svc: ServiceSpec): TrainKind {
  if (svc.id === 'southern') return svc.unitKinds?.find(k => k === 'southern-10000' || k === 'southern-12000') ?? 'southern-10000';
  return svc.unitKinds?.find(k => k === 'commuter-7100-restored' || k === 'commuter-9000') ?? svc.kind;
}

export function selectedFormation(svc: ServiceSpec): number[] {
  return svc.id !== 'southern' && selectedVehicleKind(svc) !== svc.kind ? [...svc.units].reverse() : [...svc.units];
}

/** 自車に選べる車種・編成。サザンの自由席車の候補は座席指定車の形式で決まる。 */
export function playerVehicleOptions(svc: ServiceSpec, kind = selectedVehicleKind(svc), route?: Route): PlayerVehicleOptions {
  const base = defaultVehicleOf(svc);
  if (base.kind === 'commuter-2300') return { kinds: [base.kind], formations: svc.formationOptions ?? [base.units] };
  if (svc.id === 'southern') return {
    kinds: ['southern-10000', 'southern-12000'],
    freeKinds: kind === 'southern-12000' ? ['commuter-new', 'commuter-9000'] : ['commuter-old', 'commuter-7100-restored'],
    formations: [[4, 4]],
  };
  let kinds = addUnique(svc.kindOptions ?? [base.kind], 'commuter-7100-restored');
  if (svc.id === 'local') kinds = addUnique(kinds, 'commuter-1000');
  if (svc.id === 'express' || svc.id === 'airport') kinds = addUnique(kinds, 'commuter-1000', 'commuter-9000');
  const formations = kind === 'commuter-7100-restored' ? [[4], [4, 2], [4, 4]]
    : kind === 'commuter-1000' ? [[6]] : kind === 'commuter-9000' ? [[4, 4], [6], [4, 2, 2]]
    : (svc.formationOptions ?? [base.units]).filter(u => u.length !== 1 || u[0] !== 6 || svc.id === 'limited');
  if (kind === 'commuter-7100-restored' && route && !fitsEightCars(route, svc)) {
    return { kinds, formations: formations.filter(f => carsOf(f) <= 6), platformLimit: true };
  }
  return { kinds, formations };
}

/** 保存値の順序から実際の進行方向に並べ、先頭車の形式を運転台と走行性能に反映する。 */
export function applyPlayerVehicles(route: Route, selections: Partial<Record<ServiceId, PlayerVehicleSelection>>): void {
  for (const svc of route.services ?? []) {
    const base = defaultVehicleOf(svc);
    svc.kind = base.kind;
    svc.units = [...base.units];
    svc.unitKinds = base.unitKinds?.slice();
    svc.cars = carsOf(svc.units);
    const v = selections[svc.id];
    if (!v) continue;
    const options = playerVehicleOptions(svc, v.kind, route);
    if (!options.kinds.includes(v.kind)) continue;
    if (options.freeKinds) {
      const free = v.freeKind && options.freeKinds.includes(v.freeKind) ? v.freeKind : options.freeKinds[0];
      const seatFirst = base.unitKinds?.[0] === 'southern-10000' || base.unitKinds?.[0] === 'southern-12000';
      svc.unitKinds = seatFirst ? [v.kind, free] : [free, v.kind];
      svc.units = [4, 4];
    } else {
      const savedUnits = Array.isArray(v.units) ? v.units : undefined;
      const requested = savedUnits ? carsOf(savedUnits) : v.cars;
      const chosen = options.formations.find(f => savedUnits ? sameUnits(f, savedUnits) : carsOf(f) === requested)
        ?? (options.platformLimit && requested === 8 ? options.formations.find(f => carsOf(f) === 6) : undefined)
        ?? options.formations[0];
      svc.units = [...chosen];
      const kinds = playerFormationKinds(v.kind, chosen);
      if (kinds.some(k => k !== v.kind)) {
        svc.unitKinds = kinds;
        if (!front7169ForRoute(route.id)) { svc.units.reverse(); svc.unitKinds.reverse(); }
      }
    }
    svc.kind = svc.unitKinds?.[0] ?? v.kind;
    svc.cars = carsOf(svc.units);
  }
}
