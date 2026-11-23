import { ROUTES, type DirEntry, type LineEntry } from './index';
import { selectableServices } from './service';
import type { ServiceId, ServiceSpec, TimeOfDay } from './types';

/** 同じ時間帯で全方向を調べ、種別ごとの運転候補を作る。 */
export function courseMenu(line: LineEntry, timeOfDay: TimeOfDay) {
  const services = new Map<ServiceId, ServiceSpec>();
  const routes = new Map<ServiceId, Set<string>>();
  for (const dir of line.dirs) {
    for (const svc of selectableServices(ROUTES[dir.id], timeOfDay)) {
      if (!services.has(svc.id)) {
        services.set(svc.id, svc);
        routes.set(svc.id, new Set());
      }
      routes.get(svc.id)!.add(dir.id);
    }
  }
  const directions = (service: ServiceId, dirs: DirEntry[] = line.dirs) =>
    dirs.filter(d => routes.get(service)?.has(d.id));
  function preferred(service: ServiceId, currentId: string, dirs = directions(service)) {
    const current = line.dirs.find(d => d.id === currentId);
    const section = line.sections?.find(s => s.dirs.some(d => d.id === currentId));
    return dirs.find(d => d.id === currentId)
      ?? dirs.find(d => section?.dirs.some(other => other.id === d.id))
      ?? dirs.find(d => d.label === current?.label)
      ?? dirs[0];
  }
  return { services: [...services.values()], directions, preferred };
}
