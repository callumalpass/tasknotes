import { TaskGroupKey, TaskInfo } from '../types';

/**
 * Pure service that computes hierarchical grouping
 * Returns Map<primaryGroup, Map<subgroup, TaskInfo[]>>
 */
export class HierarchicalGroupingService {
  constructor(
    private resolveUserFieldValues?: (task: TaskInfo, fieldIdOrKey: string) => string[]
  ) {}

  group(tasks: TaskInfo[], primaryKey: TaskGroupKey, subgroupKey: TaskGroupKey): Map<string, Map<string, TaskInfo[]>> {
    const hierarchical = new Map<string, Map<string, TaskInfo[]>>();

    const getValues = (task: TaskInfo, key: TaskGroupKey): string[] => {
      if (!key || key === 'none') return ['all'];

      const normalizeArray = (arr: unknown[]): string[] => {
        const cleaned = arr.map(v => String(v ?? '').trim()).filter(s => s !== '');
        return cleaned.length ? cleaned : [];
      };

      if (key.startsWith('user:')) {
        const fieldIdOrKey = key.slice('user:'.length);
        if (this.resolveUserFieldValues) {
          const resolved = this.resolveUserFieldValues(task, fieldIdOrKey) || [];
          const cleaned = normalizeArray(resolved as unknown as unknown[]);
          return cleaned.length ? cleaned : [`No ${fieldIdOrKey}`];
        }
        // Fallback to customProperties if resolver not provided
        const value = (task.customProperties as any)?.[fieldIdOrKey];
        if (Array.isArray(value)) {
          const cleaned = normalizeArray(value);
          return cleaned.length ? cleaned : [`No ${fieldIdOrKey}`];
        }
        const str = String(value ?? '').trim();
        return str !== '' ? [str] : [`No ${fieldIdOrKey}`];
      }

      switch (key) {
        case 'status': {
          const v = (task.status ?? '').trim() || 'No Status';
          return [v];
        }
        case 'priority': {
          const v = (task.priority ?? '').trim() || 'No Priority';
          return [v];
        }
        case 'context': {
          const arr = normalizeArray(task.contexts ?? []);
          return arr.length ? arr : ['No Context'];
        }
        case 'project': {
          const arr = normalizeArray(task.projects ?? []).map(s => {
            const m = s.match(/^\[\[([^|\]]+)(?:\|([^\]]+))?\]\]$/);
            if (m) {
              const target = m[1] || '';
              const alias = m[2];
              const base = alias || target.split('#')[0].split('/').pop() || target;
              return base || s;
            }
            return s;
          });
          // Deduplicate
          const uniq: string[] = [];
          const seen = new Set<string>();
          for (const v of arr) { if (!seen.has(v)) { seen.add(v); uniq.push(v); } }
          return uniq.length ? uniq : ['No Project'];
        }
        case 'tags': {
          const arr = normalizeArray(task.tags ?? []);
          return arr.length ? arr : ['No Tag'];
        }
        case 'due': {
          const d = (task.due ?? '').trim();
          return d ? [d.split('T')[0]] : ['No Due Date'];
        }
        case 'scheduled': {
          const s = (task.scheduled ?? '').trim();
          return s ? [s.split('T')[0]] : ['No Scheduled Date'];
        }
        default: {
          // Fallback to a direct property if present
          const anyTask: any = task as any;
          const v = anyTask[key];
          if (Array.isArray(v)) {
            const arr = normalizeArray(v);
            return arr.length ? arr : [`No ${key}`];
          }
          const str = String(v ?? '').trim();
          return str !== '' ? [str] : [`No ${key}`];
        }
      }
    };

    for (const task of tasks) {
      const primaries = getValues(task, primaryKey);
      const subs = getValues(task, subgroupKey);

      for (const p of primaries) {
        if (!hierarchical.has(p)) hierarchical.set(p, new Map());
        const subMap = hierarchical.get(p)!;
        for (const s of subs) {
          if (!subMap.has(s)) subMap.set(s, []);
          subMap.get(s)!.push(task);
        }
      }
    }

    return hierarchical;
  }
}

