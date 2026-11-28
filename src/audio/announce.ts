// 車内放送: Web Speech API。非対応・音声なしの環境では何もしない
// 声は端末（ブラウザ・OS）に入っている音声に任せる。音程の加工はしない
export interface Announcer {
  say(text: string, delaySec?: number, lang?: 'ja-JP' | 'en-US'): void;
  sayBilingual(ja: string, en: string, delaySec?: number): void;
  cancel(): void;
  setVolume(v: number): void;
  /** 一時停止: 予約中の放送の残り時間を保持し、読み上げ中の放送は止める（再開時にその文を最初から読み直す） */
  pause(): void;
  resume(): void;
}

type SpeechLanguage = 'ja-JP' | 'en-US';
interface SpeechItem { text: string; lang: SpeechLanguage }
interface Pending { id: number; at: number; items: SpeechItem[]; left: number }

export function createAnnouncer(): Announcer {
  const synth: SpeechSynthesis | null = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  let volume = 1, paused = false;
  const timers: Pending[] = [];
  /** 読み上げ中・読み上げ待ちの文（終わったら外す） */
  const speaking: SpeechItem[] = [];

  const pickVoice = (lang: SpeechLanguage): SpeechSynthesisVoice | null => {
    if (!synth) return null;
    const prefix = lang.slice(0, 2);
    const list = synth.getVoices().filter(v => v.lang.toLowerCase().startsWith(prefix));
    if (lang === 'en-US') {
      return list.find(v => v.lang.replace('_', '-').toLowerCase() === 'en-us') ?? list[0] ?? null;
    }
    // 女性・自然な声を優先（名前ヒューリスティック）。無ければ先頭の日本語音声
    return list.find(v => /nanami|kyoko|haruka|ayumi|female|女性/i.test(v.name)) ?? list[0] ?? null;
  };
  function speak(item: SpeechItem) {
    if (!synth || volume <= 0) return;
    try {
      const text = item.lang === 'ja-JP' ? item.text.replace(/α/g, 'アルファ').replace(/β/g, 'ベータ') : item.text;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = item.lang;
      const voice = pickVoice(item.lang); if (voice) u.voice = voice;
      u.rate = 1.0; u.pitch = 1.0; u.volume = Math.max(0, Math.min(1, volume));
      const done = () => { if (paused) return; const i = speaking.indexOf(item); if (i >= 0) speaking.splice(i, 1); };
      u.onend = done; u.onerror = done;
      synth.speak(u);
      speaking.push(item);
    } catch { /* 無視 */ }
  }
  function schedule(items: SpeechItem[], delaySec: number) {
    if (!synth || volume <= 0) return;
    const p: Pending = { id: 0, at: performance.now() + delaySec * 1000, items, left: delaySec * 1000 };
    timers.push(p);
    if (paused) return;
    p.id = window.setTimeout(() => {
      timers.splice(timers.indexOf(p), 1);
      for (const item of items) speak(item);
    }, p.left);
  }

  return {
    say(text, delaySec = 0, lang: SpeechLanguage = 'ja-JP') {
      schedule([{ text, lang }], delaySec);
    },
    sayBilingual(ja, en, delaySec = 0) {
      schedule([{ text: ja, lang: 'ja-JP' }, { text: en, lang: 'en-US' }], delaySec);
    },
    cancel() {
      while (timers.length) clearTimeout(timers.pop()!.id);
      speaking.length = 0;
      try { synth?.cancel(); } catch { /* 無視 */ }
    },
    setVolume(v) { volume = v; if (v <= 0) this.cancel(); },
    pause() {
      if (paused) return;
      paused = true;
      const now = performance.now();
      for (const p of timers) { clearTimeout(p.id); p.left = Math.max(0, p.at - now); }
      try { if (speaking.length) synth?.cancel(); } catch { /* 無視 */ }
    },
    resume() {
      if (!paused) return;
      paused = false;
      const again = speaking.splice(0), list = timers.splice(0);
      // 古い発話のキャンセル通知が遅れて届いても、再開後の発話を取り除かない。
      for (const t of again) speak({ ...t });
      for (const p of list) schedule(p.items, p.left / 1000);
    },
  };
}
