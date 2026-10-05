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
  /** 2面4線駅（島式ホーム2面）: 本線の外側に待避線、本線と待避線の間に島式ホーム。
   *  待避線を使う種別（ServiceSpec.useLoop）は分岐器で待避線へ入り、それ以外は本線のホームに停車・本線を通過 */
  loop?: StationLoop;
  /** 島式1面2線駅: 下り線と上り線の間に島式ホーム1本。線路は駅の前後でホームの両側へ膨らみ（S字）、駅の外では元の間隔へ戻る。
   *  待避線は無く、全種別が自線を使う（ホームは自線から見て右側） */
  island?: StationIsland;
  /** 種別適用後: この駅で自列車が待避線に入る（route/service.ts が設定） */
  enterLoop?: boolean;
  /** 高架駅（ホームは高架上、駅舎は高架下） */
  elevated?: boolean;
}

/** 2面4線の待避線。lat は自線待避線の横位置（左が負、例 -9.2）。対向側は route.tracks の対向線から鏡像に +lat 側へ */
export interface StationLoop { lat: number; turnoutLength: number; turnoutLimitKmh: number }

/** 島式1面2線駅の線形。spread = 各線がホーム側へ外へ膨らむ量 [m]（ホーム幅 = 線間 + 2×spread − 3.4）、length = S字（ホーム端の 70m 手前・先から）の長さ [m] */
export interface StationIsland { spread: number; length: number }

/** 運行種別（プレイヤーが選ぶ） */
export type ServiceId = 'local' | 'express' | 'limited';
/** 車両の見た目の種類（world/train-models.ts が生成） */
export type TrainKind = 'commuter-new' | 'commuter-old' | 'limited';
export interface ServiceSpec {
  id: ServiceId;
  /** 表示名（普通 / 急行 / 特急） */
  name: string;
  /** 総両数（units の合計。種別適用で route/service.ts が更新） */
  cars: number;
  /** 編成を組むユニット（両数）。4両・2両のユニットを連結する（例: 6両 = [4, 2]、8両 = [4, 4] または [4, 2, 2]） */
  units: number[];
  kind: TrainKind;
  /** 停車駅（stations の index）。それ以外は通過 */
  stops: number[];
  /** 停車駅ごとの定刻到着・発車 [s]（stations の index をキー） */
  timetable: Record<number, { arr: number; dep?: number }>;
  /** 線区最高速度 [km/h]（種別ごと。未指定なら route.lineLimit） */
  lineLimit?: number;
  /** 2面4線駅で待避線（外側）に停車する。false なら本線側のホームに停車 */
  useLoop?: boolean;
  /** プレイヤーが選べる車種（先頭が既定）。未指定なら kind 固定 */
  kindOptions?: TrainKind[];
  /** 選べる編成（units の候補。未指定なら units 固定。先頭が既定） */
  formationOptions?: number[][];
  /** 待避（この駅で後続の通過列車を待つ）: 駅 index と、通過していく列車の種別 */
  waits?: { station: number; passedBy: ServiceId }[];
}

/** 線路脇の標識。lat は左が負 */
export type Sign =
  | { kind: 'limit'; s: number; kmh: number; lat?: number; size?: number; y?: number }
  | { kind: 'limitEnd'; s: number; lat?: number }
  /** 速度制限予告標（制限の手前） */
  | { kind: 'limitNotice'; s: number; kmh: number; lat?: number }
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
  /** 駅に停車する対向列車（未指定は走り抜ける）。ドアを開けて待ち、自列車が同じ駅で停車して少し経つと発車する */
  stop?: OncomingStop;
  /** 直前の要素（待避線に停車する普通）の後ろから出現する優等列車。普通が待避線へ入る間は後ろで間隔を保ち、普通はこの列車が出口分岐器を抜けてから発車する */
  follow?: boolean;
}

/** 対向列車の停車。headS = 停止時の先頭位置 [m]（対向列車は s の減る向きへ走るので、ホームの手前側＝ from 寄り）、station = 停車駅 index */
export interface OncomingStop {
  station: number; headS: number;
  /** 2面4線駅の対向側の待避線（本線の対向線から +lat 側へ鏡像）に停車。ドアは島式ホーム側（進行方向の右）だけ開く */
  loop?: boolean;
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
  /** s = 0 の標高 [m]（上りは下りの終点側の標高から始まる） */
  elevation0?: number;
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
