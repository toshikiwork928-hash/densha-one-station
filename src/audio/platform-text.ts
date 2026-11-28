import type { Route, ServiceSpec } from '../route/types';
import { spokenDest, spokenService } from './announce-text';

/** 待避中にホームで案内する後続列車の種別・行先。 */
function trainLabel(route: Route, svc: ServiceSpec): string {
  return `${spokenService(svc)}、${spokenDest(route, svc)}行き`;
}

/** 待避する普通列車が後続列車を案内する文面。 */
export function platformAnnouncement(route: Route, svc: ServiceSpec, stops: boolean): string {
  const label = trainLabel(route, svc);
  return stops
    ? `まもなく、後続の${label}がまいります。この電車が普通車より先に発車します。`
    : `まもなく、後続の${label}が通過します。危険ですので、黄色い線の内側でお待ちください。`;
}
