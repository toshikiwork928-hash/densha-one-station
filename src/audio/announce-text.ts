// 車掌放送の文面。DOM・音声に依存しない純関数（読み上げは audio/announce.ts）。
// 駅名は読み間違いを避けるため、かな（カタカナに直して）で渡す
import type { Route, ServiceSpec, Station } from '../route/types';
import { destOf, serviceOf } from '../route/service';

/** 駅名標に合わせた英語駅名。未収録の駅は入力名を返す。 */
const STATION_EN: Record<string, string> = {
  難波: 'Namba', なんば: 'Namba', 新今宮: 'Shin-Imamiya', 天下茶屋: 'Tengachaya', 萩ノ茶屋: 'Haginochaya', 今宮戎: 'Imamiyaebisu',
  岸里玉出: 'Kishinosato-Tamade', 粉浜: 'Kohama', 住吉大社: 'Sumiyoshitaisha', 堺: 'Sakai', 浜寺公園: 'Hamaderakoen', 羽衣: 'Hagoromo',
  高石: 'Takaishi', 北助松: 'Kitasukematsu', 松ノ浜: 'Matsunohama', 泉大津: 'Izumiotsu', 忠岡: 'Tadaoka', 春木: 'Haruki', 和泉大宮: 'Izumiōmiya',
  岸和田: 'Kishiwada', 蛸地蔵: 'Takojizō', 貝塚: 'Kaizuka', 泉佐野: 'Izumisano', りんくうタウン: 'Rinkū-town', 関西空港: 'Kansai-Airport',
  羽倉崎: 'Hagurazaki', 吉見ノ里: 'Yoshiminosato', 岡田浦: 'Okadaura', 樽井: 'Tarui', 尾崎: 'Ozaki', 鳥取ノ荘: 'Tottori no Shō', 箱作: 'Hakotsukuri',
  淡輪: 'Tannowa', みさき公園: 'Misaki-kōen', 孝子: 'Kyōshi', 和歌山市: 'Wakayama-shi', 紀ノ川: 'Kinokawa', 和歌山港: 'Wakayamako', 和歌山大学前: 'Wakayama-daigaku-mae',
  橋本: 'Hashimoto', 九度山: 'Kudoyama', 高野下: 'Kōyashita', 紀伊神谷: 'Kii-Kōya', 極楽橋: 'Gokurakubashi',
  桜ヶ丘: 'Sakuragaoka', みなと川: 'Minatogawa', 諏訪ノ森: 'Suwanomori', 石津川: 'Ishizugawa', 湊: 'Minato',
  二色浜: 'Nishikinohama', 鶴原: 'Tsuruhara', 井原里: 'Iharanosato', 七道: 'Shichido', 住ノ江: 'Suminoe',
};
const stationEnglish = (s: Station): string => STATION_EN[s.name] ?? s.name;
const SERVICE_EN = { express: 'Express', airport: 'Airport Express', limited: 'Limited Express Rapi:t', southern: 'Limited Express Southern', local: 'Local' };
const serviceEnglish = (svc?: ServiceSpec): string => SERVICE_EN[svc?.id ?? 'local'];
const destinationEnglish = (route: Route, svc?: ServiceSpec): string => {
  const name = destOf(route, svc);
  return STATION_EN[name] ?? name;
};

/** ひらがなをカタカナへ（音声エンジンの漢字辞書・分かち書きに頼らない） */
export const toKatakana = (s: string): string => s.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
/** 読み上げ用の駅名 */
export const spoken = (s: Station): string => toKatakana(s.kana ?? s.name);

/** 路線の終点か（列車の本来の行先がコースの終点と違う＝なんば・和歌山市・羽倉崎など、のときは終点ではない） */
export const isTerminus = (route: Route, index: number, svc?: ServiceSpec): boolean =>
  svc?.destination ? svc.destination === route.stations[index]?.name : index === route.stations.length - 1;

/** 読み上げ用の行先（列車の本来の行先、無ければコースの終点） */
export const spokenDest = (route: Route, svc?: ServiceSpec): string =>
  svc?.destination ? toKatakana(svc.destinationKana ?? svc.destination) : spoken(route.stations[route.stations.length - 1]);

/** 車内とホームで共通の読み方を使い、特急の種別と愛称の間に間を置く。 */
export const spokenService = (svc?: ServiceSpec): string => {
  if (!svc) return '';
  if (svc.name === '普通') return '普通車';
  return svc.name.replace(/^特急(?=.)/, '特急、');
};

/** 始発駅の発車後の行先案内。サザンは「一部座席指定」、行先のある優等列車は種別も言う */
function destText(route: Route, svc?: ServiceSpec): string {
  const dest = spokenDest(route, svc);
  if (svc?.id === 'southern') return `この電車は、一部座席指定、${spokenService(svc)}、${dest}行きです。`;
  if (svc) return `この電車は、${spokenService(svc)}、${dest}行きです。`;
  return `この電車は、${dest}行きです。`;
}

/** index より後の最初の停車駅 */
function nextStop(route: Route, index: number): { sta: Station; index: number } | null {
  for (let i = index + 1; i < route.stations.length; i++) if (!route.stations[i].pass) return { sta: route.stations[i], index: i };
  return null;
}

/** 発車後の放送。始発駅の発車直後のみ挨拶と行先、待避後の発車は最初に「お待たせしました」 */
export function departText(route: Route, index: number, afterWait: boolean, svc?: ServiceSpec, stageStart = index === 0): string {
  const parts: string[] = [];
  if (afterWait) parts.push('お待たせしました。');
  if (stageStart) parts.push(`ご乗車ありがとうございます。${destText(route, svc)}`);
  const nx = nextStop(route, index);
  if (nx) parts.push(nx.index === index + 1 ? `次は、${spoken(nx.sta)}、${spoken(nx.sta)}です。` : `次は、${spoken(nx.sta)}に停まります。`);
  if (stageStart && svc && (svc.id === 'express' || svc.id === 'airport')) parts.push('携帯電話はマナーモードに設定し、通話はご遠慮ください。優先座席付近では、混雑時に電源をお切りください。');
  return parts.join('');
}

/** 発車後の英語放送。既存の日本語放送と同じ引数順で扱う。 */
export function departEnglish(route: Route, index: number, afterWait: boolean, svc?: ServiceSpec, stageStart = index === 0): string {
  const parts: string[] = [];
  if (afterWait) parts.push('Thank you for waiting. ');
  if (stageStart) parts.push(`Welcome aboard. This ${serviceEnglish(svc)} train is bound for ${destinationEnglish(route, svc)}. `);
  const nx = nextStop(route, index);
  if (nx) parts.push(`The next stop is ${stationEnglish(nx.sta)}. `);
  if (stageStart && svc && (svc.id === 'express' || svc.id === 'airport')) parts.push('Please silence your phone and avoid calls. When it is crowded, switch your phone off near priority seats.');
  return parts.join('').trim();
}

/** 乗り換え案内（到着前の放送）。towardNamba = なんば方面の列車。固有名詞は読み間違いを避けてカタカナ */
/** 乗り換え案内（駅名 → 文。towardNamba = なんば方面へ行く列車、dest = 列車の行先） */
const TRANSFERS: Record<string, (towardNamba: boolean, dest: string) => string> = {
  新今宮: () => 'JR線はお乗り換えです。',
  天下茶屋: n => n ? 'コウヤ線、地下鉄サカイスジ線、阪急キョウト・キタセンリ方面はお乗り換えください。' : '地下鉄サカイスジ線、阪急キョウト・キタセンリ方面はお乗り換えください。',
  羽衣: () => 'タカシノハマ線はお乗り換えください。',
  貝塚: () => 'ミズマ線はお乗り換えください。',
  みさき公園: () => 'タナガワ線はお乗り換えください。',
  紀ノ川: () => 'カダ線はお乗り換えください。',
  // 和歌山港へ行く列車（急行・サザン）は和歌山港線をそのまま走るので、加太線と JR 和歌山線だけを案内する
  和歌山市: (_, dest) => dest === '和歌山港' ? 'カダ線、JRワカヤマ線はお乗り換えください。' : 'カダ線、ワカヤマコウ線、JRワカヤマ線はお乗り換えください。',
  和歌山港: () => 'ナンカイフェリーはお乗り換えください。',
};
export function transferPhrase(route: Route, index: number, svc?: ServiceSpec): string {
  const f = TRANSFERS[route.stations[index].name];
  if (!f) return '';
  const dest = svc?.destination ?? route.stations[route.stations.length - 1].name;
  return f(dest === 'なんば' || dest === '難波', dest);
}

/** 駅の手前（800m）の放送。終点の手前は御礼を添える。普通が待避する駅では、到着前にも待ち合わせ・通過待ちを案内する */
export function approachText(route: Route, index: number, svc?: ServiceSpec): string {
  const sta = route.stations[index], side = sta.platform.side === 'L' ? '左' : '右';
  const tr = sta.enterLoop ? sta.loopTrack : sta.mainTrack, track = tr ? `${tr}に到着します。` : '';
  const wait = waitPhrase(route, svc, index).replace(/^当駅で/, `${spoken(sta)}で`), tr2 = transferPhrase(route, index, svc);
  if (isTerminus(route, index, svc)) return `本日もご乗車いただきありがとうございました。まもなく終点、${spoken(sta)}、${track}お出口は${side}側です。${tr2}お降りの際は、お忘れ物にご注意ください。${wait}`;
  return `まもなく、${spoken(sta)}、${track}お出口は${side}側です。${tr2}${wait}`;
}

/** 駅手前の英語放送。終点、出口側、乗換、待避を案内する。 */
export function approachEnglish(route: Route, index: number, svc?: ServiceSpec): string {
  const sta = route.stations[index], side = sta.platform.side === 'L' ? 'left' : 'right';
  const tr = sta.enterLoop ? sta.loopTrack : sta.mainTrack, track = tr ? `, platform ${tr.replace(/番線$/, '')}` : '';
  const dest = svc?.destination ?? route.stations[route.stations.length - 1].name;
  const transfer: Record<string, string> = {
    新今宮: 'Please change here for the JR lines.',
    天下茶屋: dest === 'なんば' || dest === '難波' ? 'Please change here for the Koya Line, the Subway Sakaisuji Line, and the Hankyu Kyoto and Senri Lines.' : 'Please change here for the Subway Sakaisuji Line and the Hankyu Kyoto and Senri Lines.',
    羽衣: 'Please change here for the Takashinohama Line.', 貝塚: 'Please change here for the Mizuma Line.', みさき公園: 'Please change here for the Tanagawa Line.', 紀ノ川: 'Please change here for the Kada Line.',
    和歌山市: dest === '和歌山港' ? 'Please change here for the Kada Line and the JR Wakayama Line.' : 'Please change here for the Kada Line, the Wakayamako Line, and the JR Wakayama Line.',
    和歌山港: 'Please change here for the Nankai Ferry.',
  };
  const extra = transfer[sta.name] ? ` ${transfer[sta.name]}` : '';
  const wait = waitEnglish(route, svc, index);
  const terminal = isTerminus(route, index, svc);
  const arrival = `We are arriving at ${stationEnglish(sta)}${track}. ${terminal ? 'This is the last stop. ' : ''}Doors open on the ${side}.`;
  return [arrival + extra, terminal ? 'Please take your belongings with you. Thank you for riding with us.' : '', wait].filter(Boolean).join(' ');
}

/** 普通がこの駅で優等列車を待つときの放送（待ち合わせ = 優等列車が停車、通過待ち = 通過。複数なら並べた順に「〜の通過待ちと〜の待ち合わせ」）。
 *  コースの終着駅は待ち合わせとして案内する（ゲームは着いたところで終わる） */
export function waitPhrase(route: Route, svc: ServiceSpec | undefined, index: number): string {
  const list = (svc?.waits ?? []).filter(x => x.station === index).map(w => serviceOf(route, w.passedBy)).filter((x): x is ServiceSpec => !!x);
  if (!list.length) return '';
  const last = index === route.stations.length - 1;
  const passes = list.filter(p => !last && !p.stops.includes(index)).map(p => p.name), meets = list.filter(p => last || p.stops.includes(index)).map(p => p.name);
  const parts = [passes.length ? `${passes.join('と')}の通過待ち` : '', meets.length ? `${meets.join('と')}の待ち合わせ` : ''].filter(Boolean);
  return `当駅で${parts.join('と')}をします。`;
}

/** 普通列車の待避・待ち合わせを英語で案内する。 */
export function waitEnglish(route: Route, svc: ServiceSpec | undefined, index: number): string {
  const list = (svc?.waits ?? []).filter(x => x.station === index).map(w => serviceOf(route, w.passedBy)).filter((x): x is ServiceSpec => !!x);
  if (!list.length) return '';
  const last = index === route.stations.length - 1;
  const passes = list.filter(p => !last && !p.stops.includes(index)).map(serviceEnglish);
  const meets = list.filter(p => last || p.stops.includes(index)).map(serviceEnglish);
  const parts = [passes.length ? `waiting for ${passes.join(' and ')} to pass` : '', meets.length ? `waiting for a ${meets.join(' and ')} connection` : ''].filter(Boolean);
  return `At this station, we are ${parts.join(' and ')}. `;
}
