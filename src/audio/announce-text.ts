// 車掌放送の文面。DOM・音声に依存しない純関数（読み上げは audio/announce.ts）。
// 駅名は読み間違いを避けるため、かな（カタカナに直して）で渡す
import type { Route, ServiceSpec, Station } from '../route/types';
import { serviceOf } from '../route/service';

/** ひらがなをカタカナへ（音声エンジンの漢字辞書・分かち書きに頼らない） */
export const toKatakana = (s: string): string => s.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
/** 読み上げ用の駅名 */
export const spoken = (s: Station): string => toKatakana(s.kana ?? s.name);

/** 路線の終点か */
export const isTerminus = (route: Route, index: number): boolean => index === route.stations.length - 1;

/** index より後の最初の停車駅 */
function nextStop(route: Route, index: number): { sta: Station; index: number } | null {
  for (let i = index + 1; i < route.stations.length; i++) if (!route.stations[i].pass) return { sta: route.stations[i], index: i };
  return null;
}

/** 発車後の放送。始発駅の発車直後のみ挨拶と行先、待避後の発車は最初に「お待たせしました」 */
export function departText(route: Route, index: number, afterWait: boolean): string {
  const parts: string[] = [];
  if (afterWait) parts.push('お待たせしました。');
  if (index === 0) parts.push(`ご乗車ありがとうございます。この電車は、${spoken(route.stations[route.stations.length - 1])}行きです。`);
  const nx = nextStop(route, index);
  if (nx) parts.push(nx.index === index + 1 ? `次は、${spoken(nx.sta)}、${spoken(nx.sta)}です。` : `次は、${spoken(nx.sta)}に停まります。`);
  return parts.join('');
}

/** 駅の手前（800m）の放送。終点の手前は御礼を添える */
export function approachText(route: Route, index: number): string {
  const sta = route.stations[index], side = sta.platform.side === 'L' ? '左' : '右';
  const track = sta.enterLoop && sta.loopTrack ? `${sta.loopTrack}に到着します。` : '';
  return isTerminus(route, index)
    ? `本日もご乗車いただきありがとうございました。まもなく終点、${spoken(sta)}、${track}お出口は${side}側です。`
    : `まもなく、${spoken(sta)}、${track}お出口は${side}側です。`;
}

/** 普通がこの駅で優等列車を待つときの放送（待ち合わせ = 優等列車が停車、通過待ち = 通過） */
export function waitPhrase(route: Route, svc: ServiceSpec | undefined, index: number): string {
  const w = svc?.waits?.find(x => x.station === index);
  const passer = w && serviceOf(route, w.passedBy);
  if (!w || !passer) return '';
  return passer.stops.includes(index) ? `当駅で${passer.name}の待ち合わせをします。` : `当駅で${passer.name}の通過待ちをします。`;
}

/** 急行・特急が、普通が待ち合わせている駅（自分を待っている）に停車するとき: 乗り換え案内。追い越すだけの駅では言わない */
export function connectPhrase(route: Route, svc: ServiceSpec | undefined, index: number): string {
  const local = serviceOf(route, 'local');
  if (!svc || svc.id === 'local' || !svc.stops.includes(index)) return '';
  return local?.waits?.some(w => w.station === index && w.passedBy === svc.id) ? '当駅で普通車にお乗り換えになれます。' : '';
}

/** 到着後の放送（駅名のあとに待避・乗り換え案内） */
export function arriveText(route: Route, svc: ServiceSpec | undefined, index: number): string {
  const sta = route.stations[index];
  const track = sta.enterLoop && sta.loopTrack ? `${sta.loopTrack}、` : '';
  return `${spoken(sta)}、${track}${spoken(sta)}です。${waitPhrase(route, svc, index)}${connectPhrase(route, svc, index)}`;
}
