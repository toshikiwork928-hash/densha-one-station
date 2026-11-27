// 南海本線の平日代表列車。Yahoo!乗換案内の各駅着発（2026-11-27 照合）。
// https://transit.yahoo.co.jp/timetable/26100/3951?kind=1
// https://transit.yahoo.co.jp/timetable/26841/3950?kind=1 （和歌山市発）
// https://transit.yahoo.co.jp/timetable/26840/3990?kind=1 （和歌山港発）
// 鉄道運用Hubの発車時刻を基準に、発車が1分後の駅と、着発の表示分が異なる駅を記す。
import { airportSouthernCorrections } from './airport-southern-stops';

interface Correction {
  laterDeparture?: string[];
  dwellMinutes: Record<number, string[]>;
}

const corrections: Record<string, Correction> = {
  ...airportSouthernCorrections,
  '1707': {
    dwellMinutes: {
      1: ['新今宮', '天下茶屋', '堺', '岸和田', '泉佐野', '尾崎', '和歌山大学前'],
    },
  },
  '1713': {
    laterDeparture: ['みさき公園'],
    dwellMinutes: {
      1: ['岸和田', '貝塚', '泉佐野', 'みさき公園'],
    },
  },
  '1729': {
    dwellMinutes: {
      1: ['堺', '泉大津', '岸和田', '泉佐野', '尾崎', '和歌山大学前'],
    },
  },
  '6821': {
    laterDeparture: ['紀ノ川'],
    dwellMinutes: {
      1: ['粉浜', '住ノ江', '七道', '湊', '松ノ浜', '忠岡', '春木', '樽井', '尾崎', '鳥取ノ荘', '箱作', '淡輪', '和歌山大学前', '紀ノ川'],
      3: ['岸和田'],
      4: ['浜寺公園', '泉大津'],
      6: ['泉佐野'],
      8: ['堺'],
    },
  },
  '6841': {
    laterDeparture: ['羽衣', '紀ノ川'],
    dwellMinutes: {
      1: ['新今宮', '天下茶屋', '住吉大社', '住ノ江', '七道', '湊', '石津川', '羽衣', '北助松', '貝塚', '井原里', '吉見ノ里', '岡田浦', '箱作', '淡輪', '和歌山大学前', '紀ノ川'],
      2: ['堺'],
      3: ['泉大津', '尾崎'],
      5: ['高石'],
      9: ['泉佐野'],
    },
  },
  '6893': {
    laterDeparture: ['紀ノ川'],
    dwellMinutes: {
      1: ['粉浜', '泉大津', '春木', '和泉大宮', '貝塚', '井原里', '樽井', '尾崎', '鳥取ノ荘', '箱作', '淡輪', '和歌山大学前', '紀ノ川'],
      2: ['住ノ江', '堺', '浜寺公園'],
      6: ['岸和田'],
      12: ['泉佐野'],
    },
  },
  '6915': {
    laterDeparture: ['七道', '羽衣', '紀ノ川'],
    dwellMinutes: {
      1: ['粉浜', '住ノ江', '七道', '湊', '羽衣', '和泉大宮', '岸和田', '貝塚', '鶴原', '樽井', '箱作', '淡輪', '和歌山大学前', '紀ノ川'],
      2: ['高石', '泉大津'],
      4: ['泉佐野'],
      5: ['堺'],
    },
  },
  '0508': {
    dwellMinutes: {
      1: ['みさき公園', '尾崎', '泉佐野', '岸和田', '堺', '天下茶屋', '新今宮'],
    },
  },
  '0518': {
    dwellMinutes: {
      1: ['みさき公園', '尾崎', '泉佐野', '岸和田', '堺', '天下茶屋', '新今宮'],
    },
  },
  '0546': {
    dwellMinutes: {
      1: ['みさき公園', '尾崎', '泉佐野', '岸和田', '新今宮'],
    },
  },
  '0606': {
    dwellMinutes: {
      1: ['みさき公園', '尾崎', '泉佐野', '岸和田', '天下茶屋'],
      2: ['和歌山市'],
    },
  },
  '1710': {
    dwellMinutes: {
      1: ['和歌山大学前', '泉佐野', '岸和田', '堺', '天下茶屋', '新今宮'],
    },
  },
  '1720': {
    dwellMinutes: {
      1: ['みさき公園', '尾崎', '泉佐野', '貝塚', '泉大津', '天下茶屋'],
    },
  },
  '1908': {
    dwellMinutes: {
      1: ['みさき公園', '尾崎', '泉佐野', '貝塚'],
      2: ['和歌山市'],
      3: ['岸和田'],
    },
  },
  '6812': {
    laterDeparture: ['羽倉崎'],
    dwellMinutes: {
      1: ['和歌山大学前', 'みさき公園', '岡田浦', '二色浜', '和泉大宮', '北助松', '高石', '羽衣'],
      2: ['浜寺公園'],
      5: ['尾崎'],
      6: ['泉佐野', '泉大津'],
      7: ['岸和田', '堺'],
    },
  },
  '6832': {
    dwellMinutes: {
      1: ['紀ノ川', '孝子', '淡輪', '箱作', '鳥取ノ荘', '尾崎', '樽井', '井原里', '二色浜', '蛸地蔵', '和泉大宮', '北助松', '石津川', '湊', '住吉大社', '岸里玉出', '天下茶屋', '新今宮'],
      2: ['高石'],
      3: ['泉佐野'],
      5: ['岸和田'],
      6: ['堺'],
      7: ['泉大津'],
    },
  },
  '6892': {
    dwellMinutes: {
      1: ['紀ノ川', '孝子', '淡輪', '箱作', '鳥取ノ荘', '尾崎', '樽井', '泉佐野', '井原里', '二色浜', '蛸地蔵', '春木', '忠岡', '北助松', '高石', '羽衣', '浜寺公園', '七道', '天下茶屋'],
      5: ['堺'],
      7: ['泉大津'],
    },
  },
  '6916': {
    dwellMinutes: {
      1: ['和歌山大学前', 'みさき公園', '樽井', '井原里', '二色浜', '蛸地蔵', '和泉大宮', '松ノ浜', '石津川', '湊', '七道', '住吉大社', '天下茶屋', '新今宮'],
      3: ['泉大津'],
      4: ['尾崎', '泉佐野', '岸和田'],
      8: ['堺'],
    },
  },
};

/** 公開時刻は分単位。通常停車を25秒として、到着と発車をそれぞれ掲載された分に収める。 */
export function publishedStop(no: string, station: string, base: number, endpoint: boolean) {
  const correction = corrections[no];
  if (!correction) return undefined;
  const minute = base + (correction.laterDeparture?.includes(station) ? 60 : 0);
  if (endpoint) return { arrival: minute, departure: minute };
  const gap = Number(Object.entries(correction.dwellMinutes).find(([, names]) => names.includes(station))?.[0] ?? 0);
  const arrival = minute - gap * 60 + (gap === 1 ? 35 : 0);
  return { arrival, departure: minute + (gap === 0 ? 25 : 0) };
}
