import type { TaskInfo } from '../types';

export interface SearchIndex extends Map<string, string> {}

export interface SearchDeps {
  getAliases: (taskPath: string) => string[];
}

/** Build a simple lowercased index for quick substring search */
export function buildSearchIndex(tasks: TaskInfo[], deps: SearchDeps): SearchIndex {
  const index: SearchIndex = new Map();
  for (const t of tasks) {
    const aliases = deps.getAliases(t.path).join(' ');
    const blob = `${t.title || ''} ${t.path || ''} ${aliases}`.toLowerCase();
    index.set(t.path, blob);
  }
  return index;
}

/** Apply AND search over whitespace-separated tokens in raw string */
export function filterTasksBySearch(tasks: TaskInfo[], index: SearchIndex, raw: string): TaskInfo[] {
  const q = (raw || '').trim().toLowerCase();
  if (!q) return tasks;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return tasks;
  return tasks.filter(t => {
    const blob = index.get(t.path) || '';
    for (const token of tokens) {
      if (!blob.includes(token)) return false;
    }
    return true;
  });
}

