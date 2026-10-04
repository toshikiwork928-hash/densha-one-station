// 路線データの型。路線の追加・延伸はデータ追加のみで行えるようにする

/** 線形要素。s=0 は原点、初期進行方向は -Z */
export type Segment =
  | { type: 'straight'; length: number }
  | { type: 'arc'; radius: number; /** 曲がる角度 [rad] */ angle: number; turn: 'L' | 'R' };

/** 勾配区間 [‰]。正 = 上り */
export interface Gradient { from: number; to: number; permil: number }

/** 速度制限区間（先頭基準。to は後部通過分を含めた解除位置） */
export interface SpeedLimit { from: number; to: number; kmh: number; /** バナー用の種別名 */ label?: string }

export interface Station {
  name: string;
  kana?: string;
  /** 停止位置目標 [m]（先頭位置） */
  stopS: number;
  /** ホーム範囲。side は進行方向に対する側 */
  platform: { from: number; to: number; side: 'L' | 'R' };
  /** 出発からの定刻到着 [s]（始発駅は 0） */
  scheduledArrival: number;
  /** 停車時間 [s]（途中駅用） */
  dwell?: number;
  /** 通過駅 */
  pass?: boolean;
  /** 停止位置目標の両数表示 */
  stopMarkerCars?: number;
}

/** 線路脇の標識。lat は左が負 */
export type Sign =
  | { kind: 'limit'; s: number; kmh: number; lat?: number; size?: number; y?: number }
  | { kind: 'limitEnd'; s: number; lat?: number }
  | { kind: 'distance'; s: number; meters: number; lat?: number }
  | { kind: 'stopMarker'; s: number; cars: number; lat?: number };

/** 対向列車の出現設定 */
export interface OncomingSpec {
  /** 自列車がこの位置を通過したら出現 */
  spawnAt: number;
  /** 出現時の先頭位置 */
  startS: number;
  cars: number;
  carLen: number;
  gap: number;
  kmh: number;
  /** 走行線の横位置 */
  lat: number;
}

export interface Route {
  id: string;
  name: string;
  /** 線区最高速度 [km/h] */
  lineLimit: number;
  /** 出発時の先頭位置 [m] */
  startS: number;
  /** 出発時刻 [s since 0:00] */
  startClock: number;
  /** 編成長 [m] */
  trainLength: number;
  segments: Segment[];
  gradients?: Gradient[];
  limits: SpeedLimit[];
  /** 停車順。stations[0] が始発 */
  stations: Station[];
  /** 端の駅の駅名標用（前後の架空駅名） */
  prevName?: string;
  nextName?: string;
  signs: Sign[];
  /** 線路・沿線を生成する範囲 [m] */
  extent: { from: number; to: number };
  /** 線路中心の横位置（自線 0、対向線 +4 など） */
  tracks: number[];
  /** 沿線景観のヒント */
  scenery: { cityZones: { from: number; to: number }[]; endBlockS?: number };
  oncoming: OncomingSpec[];
  /** [A] 閉そく信号（自線左側）。aspect は A のロジックが決める */
  signals?: { id: string; s: number }[];
  /** [C] 踏切（中心位置 s） */
  crossings?: { id: string; s: number; roadWidth?: number }[];
  /** [C] トンネル・高架などの構造物区間 */
  structures?: { kind: 'tunnel' | 'viaduct' | 'bridge'; from: number; to: number }[];
}
