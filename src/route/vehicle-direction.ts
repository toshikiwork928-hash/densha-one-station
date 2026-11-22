/** 路線データの進行方向から、難波方の7169号が先頭になる向きを判定する。 */
export function front7169ForRoute(routeId: string): boolean {
  return new Set(['shiokaze', 'namba', 'kishiwada-up', 'izumisano-up', 'izumisano-misaki-up', 'misaki-wakayamako-up', 'mountain-up', 'nankai-through']).has(routeId);
}
