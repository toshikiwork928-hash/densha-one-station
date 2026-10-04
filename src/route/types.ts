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
  /** 2面4線駅: 外側に待避線（ホームは待避線側）。停車列車は分岐器で待避線へ入り、通過列車は本線を通る */
  loop?: StationLoop;
}

/** 2面4線の待避線。lat は自線待避線の横位置（左が負、例 -4.2）。対向側は route.tracks の対向線から鏡像に +lat 側へ */
export interface StationLoop { lat: number; turnoutLength: number; turnoutLimitKmh: number }

/** 運行種別（プレイヤーが選ぶ） */
export type ServiceId = 'local' | 'express' | 'limited';
/** 車両の見た目の種類（world/train-models.ts が生成） */
export type TrainKind = 'commuter-new' | 'commuter-old' | 'limited';
export interface ServiceSpec {
  id: ServiceId;
  /** 表示名（普通 / 急行 / 特急） */
  name: string;
  cars: number;
  kind: TrainKind;
  /** 停車駅（stations の index）。それ以外は通過 */
  stops: number[];
  /** 停車駅ごとの定刻到着・発車 [s]（stations の index をキー） */
  timetable: Record<number, { arr: number; dep?: number }>;
  /** 線区最高速度 [km/h]（種別ごと。未指定なら route.lineLimit） */
  lineLimit?: number;
  /** プレイヤーが選べる車種（先頭が既定）。未指定なら kind 固定 */
  kindOptions?: TrainKind[];
  /** 選べる両数（未指定なら cars 固定） */
  carsOptions?: number[];
  /** 待避（この駅で後続の通過列車を待つ）: 駅 index と、通過していく列車の種別 */
  waits?: { station: number; passedBy: ServiceId }[];
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
  /** 車両の種類（未指定なら world/oncoming.ts が順に 普通/急行/特急 を割り当て） */
  kind?: TrainKind;
  /** 種別表示（普通/急行/特急）と行先 */
  label?: string;
  dest?: string;
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
  /** 運行種別（未指定なら従来どおり stations の pass/scheduledArrival を使う） */
  services?: ServiceSpec[];
  /** [A] 閉そく信号（自線左側）。aspect は A のロジックが決める */
  signals?: { id: string; s: number }[];
  /** [C] 踏切（中心位置 s） */
  crossings?: { id: string; s: number; roadWidth?: number }[];
  /** [C] トンネル・高架などの構造物区間 */
  structures?: { kind: 'tunnel' | 'viaduct' | 'bridge'; from: number; to: number }[];
}
