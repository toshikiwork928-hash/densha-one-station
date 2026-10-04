// 車内放送: Web Speech API（ja-JP）。非対応・音声なしの環境では何もしない
export interface Announcer {
  say(text: string, delaySec?: number): void;
  cancel(): void;
  setVolume(v: number): void;
}

export function createAnnouncer(): Announcer {
  const synth: SpeechSynthesis | null = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  let voice: SpeechSynthesisVoice | null = null, volume = 1;
  const timers: number[] = [];

  const pickVoice = () => {
    if (!synth) return;
    const list = synth.getVoices().filter(v => v.lang.replace('_', '-').toLowerCase().startsWith('ja'));
    // 女性・自然な声を優先（名前ヒューリスティック）
    voice = list.find(v => /nanami|kyoko|haruka|ayumi|female|女性/i.test(v.name)) ?? list[0] ?? null;
  };
  if (synth) {
    try { pickVoice(); synth.addEventListener?.('voiceschanged', pickVoice); } catch { /* 古いブラウザ */ }
  }

  return {
    say(text, delaySec = 0) {
      if (!synth || volume <= 0) return;
      const id = window.setTimeout(() => {
        try {
          if (!voice) pickVoice();
          const u = new SpeechSynthesisUtterance(text);
          u.lang = 'ja-JP'; if (voice) u.voice = voice;
          u.rate = 1.0; u.pitch = 1.1; u.volume = Math.max(0, Math.min(1, volume));
          synth.speak(u);
        } catch { /* 無視 */ }
      }, delaySec * 1000);
      timers.push(id);
    },
    cancel() {
      while (timers.length) clearTimeout(timers.pop());
      try { synth?.cancel(); } catch { /* 無視 */ }
    },
    setVolume(v) { volume = v; if (v <= 0) this.cancel(); },
  };
}
