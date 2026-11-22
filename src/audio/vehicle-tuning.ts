import type { TrainKind } from '../route/types';
import type { InverterSound, VvvfTuning } from './vvvf';

const trackLayers = ['roll', 'rail', 'wind', 'joint', 'bridge', 'flange'] as const;
const motorLayers = ['carrier', 'sideband', 'hiss', 'motor', 'hum', 'gear'] as const;

export const soundLabels: Record<InverterSound, string> = {
  'nankai-1000': '1000系（機器未更新・GTO）',
  'nankai-2000': '2000系', 'nankai-2300': '2300系', 'nankai-8300': '8300系',
  'nankai-9000': '9000系（更新車）', 'nankai-8000': '8000系と同系統の音色',
  gto: 'GTO（従来の調整モデル）', soft: '改良音', legacy: '従来音',
};

const vehicleSounds: Partial<Record<TrainKind, InverterSound>> = {
  'commuter-1000': 'nankai-1000', 'commuter-2000': 'nankai-2000', 'commuter-2300': 'nankai-2300',
  'commuter-new': 'nankai-8300', 'commuter-9000': 'nankai-9000', 'southern-12000': 'nankai-8000',
  limited: 'nankai-8000',
};

export const defaultStartHz = (sound: InverterSound) => sound === 'nankai-1000' ? 400 : 180;

export interface VehicleTuning {
  sound: InverterSound;
  vvvf: VvvfTuning;
  track: Record<typeof trackLayers[number], number>;
  cam: number;
}

export function isResistance(kind: TrainKind): boolean {
  return ['commuter-old', 'commuter-7100-restored', 'southern-10000', 'commuter-6300', 'limited-30000'].includes(kind);
}

export function defaultTuning(kind: TrainKind): VehicleTuning {
  const sound = vehicleSounds[kind] ?? 'soft';
  return {
    sound,
    vvvf: { carrier: 1, sideband: 1, hiss: 1, motor: 1, hum: 1, gear: 1, startHz: defaultStartHz(sound), transitionKmh: 10 },
    track: { roll: 1, rail: 1, wind: 1, joint: 1, bridge: 1, flange: 1 },
    cam: 1,
  };
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('設定の形式を確認してください。');
  return value as Record<string, unknown>;
}

function numberIn(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error('設定値が範囲外です。');
  }
  return value;
}

export function parseTuning(value: unknown): VehicleTuning {
  const input = record(value), vvvf = record(input.vvvf), track = record(input.track);
  const result = defaultTuning('commuter-new');
  if (typeof input.sound !== 'string' || !Object.hasOwn(soundLabels, input.sound)) throw new Error('音色を確認してください。');
  result.sound = input.sound as InverterSound;
  for (const key of motorLayers) result.vvvf[key] = numberIn(vvvf[key], 0, 2);
  for (const key of trackLayers) result.track[key] = numberIn(track[key], 0, 2);
  result.vvvf.startHz = numberIn(vvvf.startHz, 80, 1800);
  result.vvvf.transitionKmh = numberIn(vvvf.transitionKmh, 8, 28);
  result.cam = numberIn(input.cam, 0, 2);
  return result;
}

export const tuningStorageKey = (kind: TrainKind) => 'densha-one-station.vehicle-tuning.v1.' + kind;

export function savedTuning(kind: TrainKind): VehicleTuning | undefined {
  try {
    const raw = localStorage.getItem(tuningStorageKey(kind));
    if (raw) return parseTuning(JSON.parse(raw));
  } catch { /* 保存領域を利用できない場合やデータが壊れた場合は車両の初期値を使う。 */ }
  return undefined;
}

export function loadTuning(kind: TrainKind): VehicleTuning {
  return savedTuning(kind) ?? defaultTuning(kind);
}

export function saveTuning(kind: TrainKind, tuning: VehicleTuning): void {
  localStorage.setItem(tuningStorageKey(kind), JSON.stringify(parseTuning(tuning)));
}
