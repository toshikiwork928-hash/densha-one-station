// タイトル（ステージ・モード選択）・結果画面
import { notchName } from '../core/config';
import type { GameContext } from '../core/context';
import { $, fmtClock } from '../core/dom';
import { getBest, submitScore } from '../game/ranking';
import type { GameResult } from '../game/scoring';
import { safetyDeductions } from '../game/scoring';
import { MODE_LABEL, findStage, stagesOf, type GameMode } from '../game/state';

const MODE_DESC: Record<GameMode, string> = {
  normal: '停止位置・定時・安全で採点',
  recovery: '遅れて発車。遅着に厳しい',
  timeOnly: '定時と安全のみ採点',
};

export function attachOverlay(ctx: GameContext): void {
  const { route, events } = ctx, st = ctx.state;
  const overlay = $('overlay'), card = $('card');
  let lastResult: GameResult | null = null;
  let lastRecord: { isNew: boolean; prevTotal?: number } = { isNew: false };

  function bindGo() { $('go').onclick = () => ctx.actions.startOrRetry(); }

  // タイトルのタブ（再描画しても選択を保持）
  type Tab = 'stage' | 'env' | 'sound' | 'keys';
  const TABS: [Tab, string][] = [['stage', 'ステージ'], ['env', '環境'], ['sound', 'サウンド'], ['keys', '操作']];
  let tab: Tab = 'stage';
  function showTab(t: Tab) {
    tab = t;
    card.querySelectorAll<HTMLElement>('[data-tab]').forEach(b => { b.classList.toggle('on', b.dataset.tab === t); b.setAttribute('aria-selected', String(b.dataset.tab === t)); });
    card.querySelectorAll<HTMLElement>('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== t; });
  }

  function showTitle() {
    const ready = ctx.assetsReady;
    const stage = findStage(route, st.sel.stageId);
    const first = route.stations[stage.from], last = route.stations[stage.to];
    const passes = route.stations.filter((x, i) => x.pass && i > stage.from && i < stage.to).map(x => x.name);
    const stops = route.stations.filter((x, i) => !x.pass && i > stage.from && i < stage.to).map(x => x.name);
    const lims = route.limits.filter(L => L.from > first.stopS && L.from < last.stopS);
    const notes = [
      lims.length ? `制限 ${[...new Set(lims.map(L => L.kmh))].join('・')}km/h` : '',
      stops.length ? `途中停車 ${stops.join('・')}` : '',
      passes.length ? `<b>${passes.join('・')} は通過</b>` : '',
    ].filter(Boolean).join('、');
    const best = getBest(route.id, stage.id, st.sel.mode);
    const stages = stagesOf(route).map(s => `<button data-stage="${s.id}" class="${s.id === stage.id ? 'on' : ''}">${s.id === 'all' ? '全線通し' : s.label}${s.id === 'all' ? `<small>${route.stations[s.from].name} → ${route.stations[s.to].name}</small>` : ''}</button>`).join('');
    const modes = (Object.keys(MODE_LABEL) as GameMode[]).map(m => `<button data-mode="${m}" class="${m === st.sel.mode ? 'on' : ''}">${MODE_LABEL[m]}<small>${MODE_DESC[m]}</small></button>`).join('');
    overlay.classList.remove('hidden');
    card.innerHTML = `
    <h1>汐風線 運転シミュレーター<small>運転台視点の電車運転ゲーム / Three.js</small></h1>
    <div class="route"><span>${first.name}</span><span class="bar"></span><span>${last.name}</span></div>
    <div class="tabs" role="tablist">${TABS.map(([k, n]) => `<button type="button" role="tab" data-tab="${k}">${n}</button>`).join('')}</div>
    <div class="tabPane" data-pane="stage">
      <div class="selLbl">ステージ（← →）</div><div class="sel" id="selStage">${stages}</div>
      <div class="selLbl">モード（↑ ↓）</div><div class="sel" id="selMode">${modes}</div>
      <p class="brief">${first.name}を定刻に発車し、${last.name}の<b>停止位置ピッタリ</b>に<b>定刻どおり</b>止めよう。${notes ? notes + '。' : ''}信号（YG 65 / Y 45 / R 停止）に従うこと。</p>
      <div class="best">${best ? `自己ベスト ${best.total}点（${best.rank}）${best.date}` : '自己ベスト なし'}</div>
    </div>
    <div class="tabPane" data-pane="env" hidden></div>
    <div class="tabPane" data-pane="sound" hidden></div>
    <div class="tabPane" data-pane="keys" hidden>
      <table class="keys">
        <tr><td><kbd>↑</kbd> <kbd>W</kbd> / <kbd>↓</kbd> <kbd>S</kbd></td><td>力行側 / ブレーキ側へ1段</td></tr>
        <tr><td><kbd>N</kbd> / <kbd>Space</kbd></td><td>ノッチオフ / 非常ブレーキ（減点）</td></tr>
        <tr><td><kbd>A</kbd></td><td>ATS 確認（B4 以上で）</td></tr>
        <tr><td><kbd>H</kbd> / <kbd>V</kbd></td><td>警笛（長押し） / 視点切替</td></tr>
        <tr><td><kbd>X</kbd> / <kbd>M</kbd></td><td>ワイパー / 消音</td></tr>
        <tr><td><kbd>Shift</kbd>+<kbd>T</kbd> <kbd>Y</kbd> <kbd>Q</kbd></td><td>時間帯 / 天候 / 画質</td></tr>
        <tr><td><kbd>R</kbd> / <kbd>Esc</kbd></td><td>結果画面でリプレイ / タイトルへ</td></tr>
      </table>
      <p class="sub">途中駅はドアが閉まったら力行で発車。ゲームパッド対応（L3 でレバーモード）。タッチ端末は画面右下のボタン。</p>
    </div>
    <div id="titleExtra" hidden></div>
    <button class="btn" id="go" ${ready ? '' : 'disabled'}>${ready ? '出発（Enter）' : '3D素材を読み込み中…'}</button>
    <p class="sub credit">3D素材: Kenney / Quaternius（CC0）。駅名・路線名は架空</p>`;
    bindGo();
    card.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b => b.onclick = () => { showTab(b.dataset.tab as Tab); b.blur(); });
    card.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach(b => b.onclick = () => {
      const list = stagesOf(route), cur = list.findIndex(s => s.id === st.sel.stageId), to = list.findIndex(s => s.id === b.dataset.stage);
      ctx.actions.selectStage(to - cur);
    });
    card.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b => b.onclick = () => {
      const list = Object.keys(MODE_LABEL), cur = list.indexOf(st.sel.mode), to = list.indexOf(b.dataset.mode!);
      ctx.actions.selectMode(to - cur);
    });
    // 他モジュールの設定 UI を受け取り、各タブへ振り分ける
    const extra = $('titleExtra');
    events.emit('titleRender', { container: extra });
    const pane = (k: Tab) => card.querySelector<HTMLElement>(`[data-pane="${k}"]`)!;
    extra.querySelectorAll('.env-panel').forEach(e => pane('env').appendChild(e));
    extra.querySelectorAll('.audio-settings').forEach(e => pane('sound').appendChild(e));
    while (extra.firstChild) pane('stage').appendChild(extra.firstChild);
    showTab(tab);
  }

  function showResult(r: GameResult) {
    lastResult = r;
    const j = r.last, err = j.err, delay = j.delay;
    let note = '';
    if (r.kind === 'overrun') note = '<div class="pitari" style="color:#ff7a6a">オーバーラン！</div>';
    else if (Math.abs(err) <= .3) note = '<div class="pitari">停止位置ピッタリ！</div>';
    else if (err < -15) note = '<div class="pitari" style="color:#ffb02e">停止位置まで届かず…</div>';
    if (lastRecord.isNew) note += '<div class="pitari">自己ベスト更新！</div>';
    const stage = findStage(route, r.stageId);
    const sta = route.stations[j.index];
    const sgn = (x: number, d = 1) => `${x >= 0 ? '+' : ''}${x.toFixed(d)}`;
    const errTxt = `${sgn(err, 2)} m（${err >= 0 ? '行き過ぎ' : '手前'}）`;
    // 駅ごとの表（停車・通過を駅順に）
    const rows = [
      ...r.stops.map(s => ({ i: s.index, html: `<tr><td>${route.stations[s.index].name}</td><td>${s.kind === 'overrun' ? 'オーバーラン' : `${sgn(s.err, 2)}m`}</td><td>${sgn(s.delay)}秒</td><td>${Math.round(s.stopPts + s.timePts)}</td></tr>` })),
      ...r.passes.map(p => ({ i: p.index, html: `<tr><td>${route.stations[p.index].name}</td><td>${p.wrongStop ? '<span style="color:#ff7a6a">誤停車</span>' : '通過'}</td><td>${sgn(p.delay)}秒</td><td>-</td></tr>` })),
    ].sort((a, b) => a.i - b.i).map(x => x.html).join('');
    const ded = safetyDeductions(st).map(d => `${d.label} -${Math.round(d.pts)}`).join(' / ') || 'なし';
    const best = getBest(route.id, r.stageId, r.mode);
    overlay.classList.remove('hidden');
    card.innerHTML = `
    <h1>${r.kind === 'overrun' ? '失格' : `${sta.name} 到着`}<small>${stage.id === 'all' ? '全線通し' : stage.label}・${MODE_LABEL[r.mode]}モード</small></h1>
    <div class="rank ${r.rank}">${r.rank}</div>${note}
    <table class="res">
      <tr><td>停止位置誤差</td><td>${errTxt}</td></tr>
      <tr><td>到着時刻（定刻比）</td><td>${fmtClock(route.startClock + j.t)}（${sgn(delay)} 秒）</td></tr>
      <tr><td>速度超過時間</td><td>${r.overspeed.toFixed(1)} 秒</td></tr>
      <tr><td>非常ブレーキ使用</td><td>${r.eb ? 'あり' : 'なし'}</td></tr>
      <tr><td>停車時の衝動</td><td>${j.jolt ? `あり（${notchName(j.notchAtStop)}で停車）` : 'なし'}</td></tr>
      <tr><td>停止 / 定時 / 安全</td><td>${Math.round(r.stopPts)}/${r.max.stop} · ${Math.round(r.timePts)}/${r.max.time} · ${Math.round(r.safePts)}/${r.max.safe}</td></tr>
    </table>
    ${r.stops.length + r.passes.length > 1 ? `<table class="res st"><tr><td>駅</td><td>停止位置</td><td>定刻比</td><td>点</td></tr>${rows}</table>` : ''}
    <p class="sub">安全減点: ${ded}</p>
    <div class="total">${r.total} 点</div>
    <div class="best">${best ? `自己ベスト ${best.total}点（${best.rank}）` : ''}</div>
    <button class="btn" id="go">もう一度（Enter）</button>
    <div class="btnRow"><button class="btn sub2" id="replayBtn">リプレイ（R）</button><button class="btn sub2" id="titleBtn">タイトルへ（Esc）</button></div>`;
    bindGo();
    $('replayBtn').onclick = () => ctx.actions.toggleReplay();
    $('titleBtn').onclick = () => ctx.actions.toTitle();
  }

  showTitle();
  events.on('assetsProgress', ({ done, total }) => {
    const b = document.getElementById('go');
    if (b && !ctx.assetsReady) b.textContent = `3D素材を読み込み中… ${done}/${total}`;
  });
  events.on('assetsReady', () => { if (st.state === 'title') showTitle(); });
  events.on('reset', () => { if (st.state === 'title') showTitle(); });
  events.on('stateChange', ({ to }) => { if (to === 'run') overlay.classList.add('hidden'); });
  events.on('result', r => {
    const rec = r.kind === 'stop' ? submitScore(route.id, r.stageId, r.mode, r.total, r.rank) : { isNew: false };
    lastRecord = { isNew: rec.isNew };
    showResult(r);
  });
  // リプレイ中は結果カードを隠し、終わったら戻す
  events.on('cameraMode', ({ mode }) => {
    if (st.state !== 'result' || !lastResult) return;
    if (mode === 'replay') overlay.classList.add('hidden');
    else { lastRecord = { isNew: false }; showResult(lastResult); }
  });
}
