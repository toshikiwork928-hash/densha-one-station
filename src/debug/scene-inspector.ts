// 開発時 ?inspect=1 のみ。走行処理を止めて実際のワールドを駅・構造物ごとに確認する。
import type { GameContext } from '../core/context';

export function attachSceneInspector(ctx: GameContext): () => void {
  let overview = false;
  const style = document.createElement('style');
  style.textContent = '#overlay,#hud,.look-switch{display:none!important}.scene-inspector{position:fixed;top:8px;left:8px;z-index:200;background:#14202be8;color:white;padding:10px;border-radius:8px;font:14px sans-serif}.scene-inspector select,.scene-inspector button{margin:4px;padding:6px}';
  document.head.append(style);
  const panel = document.createElement('div'); panel.className = 'scene-inspector';
  const select = document.createElement('select'); select.setAttribute('aria-label', '景観確認地点');
  const points = [
    ...ctx.route.stations.map(st => ({ label: st.name + '駅', s: st.stopS - 20 })),
    ...(ctx.route.coastalLandmarks ?? []).map(l => ({ label: l.label ?? l.kind, s: l.s - 40 })),
  ];
  for (const [i, p] of points.entries()) { const o = document.createElement('option'); o.value = String(i); o.textContent = p.label; select.append(o); }
  const move = () => {
    ctx.state.state = 'title'; ctx.state.train.s = points[Number(select.value)].s; ctx.state.train.v = 0;
    ctx.state.train.notch = 0;
    ctx.events.emit('cameraMode', { mode: ctx.cameraMode });
  };
  select.onchange = move;
  const view = document.createElement('button'); view.textContent = '視点切替';
  view.onclick = () => ctx.actions.cycleCamera();
  const wide = document.createElement('button'); wide.textContent = '景観俯瞰';
  wide.onclick = () => { overview = !overview; wide.setAttribute('aria-pressed', String(overview)); };
  panel.append('景観確認 ', select, view, wide); document.body.append(panel);
  ctx.cameraMode = 'outside'; move();
  return () => {
    if (!overview) return;
    const s = ctx.state.train.s, side = ctx.route.id.endsWith('-up') ? 1 : -1;
    ctx.camera.position.copy(ctx.track.at(s - 110, side * 85, 65));
    ctx.camera.lookAt(ctx.track.at(s - 45, side * 8, 0));
  };
}
