// 車内放送: Web Speech API（ja-JP）。非対応・音声なしの環境では何もしない
// 声は端末に入っている日本語音声から選ぶ。男声・女声は音声名から推定し、該当する声が無い端末では音程で近似する
export type VoiceGender = 'female' | 'male';

export interface Announcer {
  say(text: string, delaySec?: number): void;
  cancel(): void;
  setVolume(v: number): void;
  setGender(g: VoiceGender): void;
  /** 試聴（放送を止めて即時に読み上げ） */
  preview(text: string): void;
  /** 使っている声の説明（設定画面用） */
  describe(): string;
}

const MALE = /ichiro|keita|takumi|otoya|hattori|\bken\b|male(?!\w*female)|男/i;
const FEMALE = /nanami|haruka|ayumi|sayaka|mizuki|kyoko|o-?ren|female|女|google\s*(日本語|japanese)/i;

/** 声の一覧から性別に合うものを選ぶ。戻り値 exact = 名前から性別が確認できた声か */
export function chooseVoice<T extends { name: string }>(list: T[], gender: VoiceGender): { voice: T | null; exact: boolean } {
  if (!list.length) return { voice: null, exact: false };
  const natural = (v: T) => /natural|online/i.test(v.name) ? 0 : 1; // 高品質版を優先
  const by = (re: RegExp, not?: RegExp) => list.filter(v => re.test(v.name) && !(not && not.test(v.name))).sort((a, b) => natural(a) - natural(b))[0];
  if (gender === 'male') {
    const m = by(MALE);
    return m ? { voice: m, exact: true } : { voice: list.find(v => !FEMALE.test(v.name)) ?? list[0], exact: false };
  }
  const f = by(FEMALE, MALE);
  if (f) return { voice: f, exact: true };
  const other = list.find(v => !MALE.test(v.name));
  return { voice: other ?? list[0], exact: false };
}

export function createAnnouncer(): Announcer {
  const synth: SpeechSynthesis | null = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  let voice: SpeechSynthesisVoice | null = null, exact = false, volume = 1, gender: VoiceGender = 'female';
  const timers: number[] = [];

  const pickVoice = () => {
    if (!synth) return;
    const list = synth.getVoices().filter(v => v.lang.replace('_', '-').toLowerCase().startsWith('ja'));
    ({ voice, exact } = chooseVoice(list, gender));
  };
  if (synth) {
    try { pickVoice(); synth.addEventListener?.('voiceschanged', pickVoice); } catch { /* 古いブラウザ */ }
  }

  function speak(text: string) {
    try {
      if (!voice) pickVoice();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ja-JP'; if (voice) u.voice = voice;
      // 声が性別を確認できないときは音程で近似（男声は低く、女声は高く）
      u.rate = 1.0; u.pitch = exact ? (gender === 'male' ? .95 : 1.05) : gender === 'male' ? .6 : 1.2;
      u.volume = Math.max(0, Math.min(1, volume));
      synth!.speak(u);
    } catch { /* 無視 */ }
  }

  return {
    say(text, delaySec = 0) {
      if (!synth || volume <= 0) return;
      timers.push(window.setTimeout(() => speak(text), delaySec * 1000));
    },
    cancel() {
      while (timers.length) clearTimeout(timers.pop());
      try { synth?.cancel(); } catch { /* 無視 */ }
    },
    setVolume(v) { volume = v; if (v <= 0) this.cancel(); },
    setGender(g) { gender = g; pickVoice(); },
    preview(text) {
      if (!synth) return;
      this.cancel();
      if (volume > 0) speak(text);
    },
    describe() {
      if (!synth) return 'この環境では音声読み上げを使えません';
      if (!voice) return '日本語の音声が見つかりません（放送は無音）';
      return `${voice.name}${exact ? '' : gender === 'male' ? '（男声が無いため音程を下げて近似）' : '（女声を確認できないため音程で近似）'}`;
    },
  };
}
