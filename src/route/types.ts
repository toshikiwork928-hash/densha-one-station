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
  /** 沿岸線の駅固有意匠。線路運行は loop / island に従う。 */
  layout?: 'relative' | 'island' | 'loop' | 'hagoromo' | 'hamadera';
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
  /** 2面4線で、待避線（外側の線）を優等列車が使い、普通は本線側に停車する駅（堺の上り: 普通 = 3番線、優等 = 4番線。下り側の1・2番線と同じ並び） */
  loopPriority?: boolean;
  /** 本線側の番線名（loopPriority の駅で普通が入る番線の案内） */
  mainTrack?: string;
  /** 待避線側の番線名（例 '3番線'）。待避線へ入る種別（enterLoop）の到着案内に使う */
  loopTrack?: string;
  /** 島式1面2線駅: 下り線と上り線の間に島式ホーム1本。線路は駅の前後でホームの両側へ膨らみ（S字）、駅の外では元の間隔へ戻る。
   *  待避線は無く、全種別が自線を使う（ホームは自線から見て右側） */
  island?: StationIsland;
  /** 種別適用後: この駅で自列車が待避線に入る（route/service.ts が設定） */
  enterLoop?: boolean;
  /** 高架駅（ホームは高架上、駅舎は高架下） */
  elevated?: boolean;
  /** 頭端式（行き止まり）の終端駅。線路はホームの先（下りなら platform.to 側、route.extent の端）で車止めに終わる */
  headEnd?: boolean;
  /** 屋内式の駅（岸和田）: ホーム全体を屋根と壁で覆い、ホームに入ると外が見えない（駅の前後の開口部だけ）。world が室内として描き、環境光・音をトンネル同様に扱う */
  indoor?: boolean;
  /** 相対式2面2線で上下のホームを前後にずらす駅（踏切を挟んだ対面ホーム）。対向線側のホームは platform から s 方向へこの距離だけずれる（上下とも同じ符号） */
  platformOpp?: number;
}

/** 2面4線の待避線。lat は自線待避線の横位置（左が負、例 -9.2）。対向側は route.tracks の対向線から鏡像に +lat 側へ */
export interface StationLoop {
  lat: number; turnoutLength: number; turnoutLimitKmh: number;
  /** 待避線のホームが待避線の外側（本線と反対側）にある（浜寺公園の堺方面）。既定は本線と待避線の間の島式 */
  outside?: boolean;
}

/** 島式1面2線駅の線形。spread = 各線がホーム側へ外へ膨らむ量 [m]（ホーム幅 = 線間 + 2×spread − 3.4）、length = S字（ホーム端の 70m 手前・先から）の長さ [m]。
 *  単線（route.singleTrack）では1本の線路が駅の前後の分岐器（両開き）で左右へ分かれ、自列車は左（-spread）、対向列車は右（+spread）を通る＝交換設備（ホーム幅 = 2×spread − 3.4） */
export interface StationIsland {
  spread: number; length: number;
  /** 分岐器（S字）の制限 [km/h]。指定時は S字の始まりから後部が抜けるまで制限（単線の交換駅・頭端駅） */
  turnoutLimitKmh?: number;
  /** 単線の駅の副線（3線目）: 島式ホームの線路の外側に並ぶ行き止まりの線路と片面ホーム。lat = ホーム区間での線路中心の横位置（例 +8.4。符号の側の島式の線へ分岐器で合流）、
   *  bumper = 車止めの側（behind = 進行方向の手前、ahead = 先）、platformWidth = 外側の片面ホームの幅（ホーム端は線路中心から 1.7m）。形状は route/service.ts の bayZone */
  bay?: { lat: number; bumper: 'behind' | 'ahead'; platformWidth: number };
}

/** 単線の交換駅での行き違い（対向列車）。station = 交換駅の index（その向きの route.stations）。自列車はこの駅で対向列車の到着を待って発車する（game/meet.ts） */
export interface MeetSpec { station: number; kind: TrainKind; cars: number; /** 巡航速度 [km/h] */ kmh: number; label?: string; dest?: string }

/** 運行種別（プレイヤーが選ぶ） */
/** southern = 特急サザン（10000系 + 7100系の8両。座席指定車と自由席車の併結） */
export type ServiceId = 'local' | 'express' | 'limited' | 'southern';
/** 車両の見た目の種類（world/train-models.ts が生成） */
/** commuter-2300 = 山岳線用の 2300系（18m 車体・2両ユニット）、southern-10000 = 特急サザンの座席指定車（10000系、4両ユニット） */
export type TrainKind = 'commuter-new' | 'commuter-old' | 'limited' | 'commuter-2300' | 'southern-10000';
export interface ServiceSpec {
  id: ServiceId;
  /** 表示名（普通 / 急行 / 特急） */
  name: string;
  /** 総両数（units の合計。種別適用で route/service.ts が更新） */
  cars: number;
  /** 編成を組むユニット（両数）。4両・2両のユニットを連結する（例: 6両 = [4, 2]、8両 = [4, 4] または [4, 2, 2]） */
  units: number[];
  /** 先頭車の車種（性能・1両の長さもこれ） */
  kind: TrainKind;
  /** ユニットごとの車種（units と同じ並び、先頭のユニットから）。未指定なら全ユニット kind。サザン（10000系 + 7100系）のような車種混成の編成用 */
  unitKinds?: TrainKind[];
  /** 列車の本来の行先（行先表示・放送）。未指定ならコースの終点駅名。かなは destinationKana */
  destination?: string;
  destinationKana?: string;
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
  /** ユニットごとの車種・両数（サザン = ['southern-10000', 'commuter-old'] と [4, 4]）。未指定は kind と cars から従来どおり */
  unitKinds?: TrainKind[];
  units?: number[];
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
  /** 対向側の待避線の形が自線側の鏡像でない駅（浜寺公園の泉大津方面の副線）の待避線区間。lat は自線側の符号（例 -9.2 → 対向線から +9.2） */
  zone?: { inFrom: number; inTo: number; outFrom: number; outTo: number; lat: number; limit: number };
}

export interface Route {
  /** コース終着駅への接近を連続速度照査（実路線ATSの仕様そのものではない）。南海本線は無効（false）。 */
  terminalApproach?: boolean;
  /** 描画専用の沿岸線ランドマーク。進行反転時は位置・左右・分岐向きを反転する。 */
  coastalLandmarks?: { kind: 'road-overpass' | 'tram-overpass' | 'steel-bridge' | 'branch' | 'tower' | 'twin-tower'; s: number; length?: number; label?: string; side?: 1 | -1; direction?: 1 | -1;
    /** 区間データの向きが反転済み（reverseRoute で作った側）。未指定なら route.id の '-up' で判定。通しコース（route/concat.ts）は区間ごとに持ち越す */
    reversed?: boolean }[];
  id: string;
  name: string;
  /** 路線（線区）の識別子。同じ線区の下り・上りで共通（例 'shiokaze'、'mountain'）。メニューの路線選択に使う */
  lineId?: string;
  /** 海の側（進行方向に対して。-1 = 左、1 = 右）。未指定なら高架支線の側（従来どおり） */
  seaSide?: 1 | -1;
  /** 沿線の景観テーマ（既定 'coast' = 南海本線の街並み・海沿い、'mountain' = 山岳線） */
  theme?: 'coast' | 'mountain';
  /** 単線区間（駅の交換設備以外は1線）。true なら route.tracks は自線のみ、行き違いは駅の交換設備で行う */
  singleTrack?: boolean;
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
  /** 端の駅の駅名標用（前後の隣の駅名） */
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
  /** 単線の交換駅での行き違い（game/meet.ts が対向列車を動かし、world/oncoming.ts が描く） */
  meets?: MeetSpec[];
  /** 停止位置目標 stopS の基準両数（既定 6）。短い編成は (基準 − 両数) × 1両の長さ / 2 だけ手前に止まる */
  stopBaseCars?: number;
  /** 先行の普通との時隔 [s] の路線ごとの上書き（待避駅が無く、優等列車が途中で普通に追いつかないように広げる） */
  precedingHeadway?: Partial<Record<ServiceId, number>>;
  /** 運行種別（未指定なら従来どおり stations の pass/scheduledArrival を使う） */
  services?: ServiceSpec[];
  /** [A] 閉そく信号（自線左側）。aspect は A のロジックが決める */
  signals?: { id: string; s: number }[];
  /** [C] 踏切（中心位置 s） */
  crossings?: { id: string; s: number; roadWidth?: number }[];
  /** [C] トンネル・高架などの構造物区間 */
  structures?: { kind: 'tunnel' | 'viaduct' | 'bridge'; from: number; to: number }[];
}
