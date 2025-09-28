import { TaskGroupKey, TaskInfo } from '../types';

/**
 * Pure service that computes hierarchical grouping
 * Returns Map<primaryGroup, Map<subgroup, TaskInfo[]>>
 */
export class HierarchicalGroupingService {
  constructor(
    private resolveUserFieldValues?: (task: TaskInfo, fieldIdOrKey: string) => string[]
  ) {}

  group(
    tasks: TaskInfo[],
    primaryKey: TaskGroupKey,
    subgroupKey: TaskGroupKey,
    sortDirection: 'asc' | 'desc' = 'asc',
    userFields: any[] = []
  ): Map<string, Map<string, TaskInfo[]>> {
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

    // Sort subgroups within each primary group
    const sortedHierarchical = new Map<string, Map<string, TaskInfo[]>>();
    for (const [primaryName, subgroups] of hierarchical) {
      const sortedSubgroups = this.sortSubgroups(subgroups, subgroupKey, sortDirection, userFields);
      sortedHierarchical.set(primaryName, sortedSubgroups);
    }

    return sortedHierarchical;
  }

  /**
   * Sort subgroups consistently with AgendaView logic
   */
  private sortSubgroups(
    subgroups: Map<string, TaskInfo[]>,
    subgroupKey: TaskGroupKey,
    sortDirection: 'asc' | 'desc',
    userFields: any[]
  ): Map<string, TaskInfo[]> {
    const keys = Array.from(subgroups.keys());
    const sortedKeys = this.sortSubgroupKeys(keys, subgroupKey, sortDirection, userFields);

    const sorted = new Map<string, TaskInfo[]>();
    for (const key of sortedKeys) {
      sorted.set(key, subgroups.get(key)!);
    }
    return sorted;
  }

  /**
   * Sort subgroup keys with "No <field>" positioning and type-aware sorting
   */
  private sortSubgroupKeys(
    keys: string[],
    subgroupKey: TaskGroupKey,
    sortDirection: 'asc' | 'desc',
    userFields: any[]
  ): string[] {
    const isMissing = (k: string) => /^No\s/i.test(k);

    // Handle dynamic user fields with type-aware sorting
    if (typeof subgroupKey === 'string' && subgroupKey.startsWith('user:')) {
      const fieldId = subgroupKey.slice(5);
      const field = userFields.find((f: any) => (f.id || f.key) === fieldId);

      const ascCompare = (a: string, b: string) => {
        if (isMissing(a) && !isMissing(b)) return -1;
        if (!isMissing(a) && isMissing(b)) return 1;
        if (field?.type === 'number') {
          const na = parseFloat(a), nb = parseFloat(b);
          const va = isNaN(na) ? Number.POSITIVE_INFINITY : na;
          const vb = isNaN(nb) ? Number.POSITIVE_INFINITY : nb;
          if (va !== vb) return va - vb;
        } else if (field?.type === 'boolean') {
          const va = a === 'true' ? 0 : a === 'false' ? 1 : 2;
          const vb = b === 'true' ? 0 : b === 'false' ? 1 : 2;
          if (va !== vb) return va - vb;
        } else if (field?.type === 'date') {
          const ta = Date.parse(a); const tb = Date.parse(b);
          const va = isNaN(ta) ? Number.POSITIVE_INFINITY : ta;
          const vb = isNaN(tb) ? Number.POSITIVE_INFINITY : tb;
          if (va !== vb) return va - vb;
        }
        return a.localeCompare(b);
      };

      const sortedUser = keys.slice().sort(ascCompare);
      return sortDirection === 'desc' ? sortedUser.reverse() : sortedUser;
    }

    // Default alphabetical with missing-first for asc
    const asc = keys.slice().sort((a, b) => {
      if (isMissing(a) && !isMissing(b)) return -1;
      if (!isMissing(a) && isMissing(b)) return 1;
      return a.localeCompare(b);
    });
    return sortDirection === 'desc' ? asc.reverse() : asc;
  }
}

