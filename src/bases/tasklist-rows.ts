import type { TaskInfo } from '../types';

// Extended property config passed to TaskCard for rendering
export interface BasesSelectedProperty {
  id: string;
  displayName: string; // Bases/native display name for intelligibility in menus/filters
  visible: boolean;
  // TaskNotes extensions for UI rendering only (do not affect Bases internals)
  tnLabel?: string | null; // null -> suppress label; string -> override label; undefined -> use displayName
  tnSeparator?: string; // custom separator between label and value; default to ': '
}
export interface BasesRowConfig {
  selected: BasesSelectedProperty[];
  getValue: (taskPath: string, propId: string) => unknown;
}

export interface TasklistRows { row3?: BasesRowConfig; row4?: BasesRowConfig }

function isNonEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function buildIdIndex(propsMap?: Record<string, any>): Map<string, string> {
  const idIndex = new Map<string, string>();
  if (!propsMap || typeof propsMap !== 'object') return idIndex;
  for (const id of Object.keys(propsMap)) {
    idIndex.set(id, id);
    const last = id.includes('.') ? id.split('.').pop()! : id;
    idIndex.set(last, id);
    const dn = propsMap[id]?.getDisplayName?.();
    if (typeof dn === 'string' && dn.trim()) idIndex.set(dn.toLowerCase(), id);
  }
  return idIndex;
}

function normalizeTokens(tokens: unknown, idIndex: Map<string, string>): string[] {
  if (!tokens) return [];
  const arr = Array.isArray(tokens) ? tokens : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of arr) {
    let raw: string = '';
    if (typeof token === 'string') {
      raw = token;
    } else if (token && typeof token === 'object') {
      const keys = Object.keys(token as any);
      if (keys.length === 1) raw = keys[0];
      else raw = '';
    } else {
      raw = String(token || '');
    }
    const t = String(raw || '');
    if (!t) continue;
    const id = idIndex.get(t) || idIndex.get(t.toLowerCase()) || t;
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

function makeGetValue(pathToProps: Map<string, any>) {
  return (taskPath: string, propId: string): unknown => {
    const props = pathToProps.get(taskPath) || {};
    const v = props[propId];
    if (isNonEmpty(v)) return v;
    const last = propId.includes('.') ? propId.split('.').pop()! : propId;
    return props[last];
  };
}

export function getTaskNotesTasklistRows(basesContainer: any, pathToProps: Map<string, any>): TasklistRows {
  try {
    const controller = (basesContainer?.controller ?? basesContainer) as any;
    const query = (basesContainer?.query ?? controller?.query) as any;
    if (!controller) return {};

    const fullCfg = controller?.getViewConfig?.() ?? {};
    const propsMap: Record<string, any> | undefined = query?.properties;
    const idIndex = buildIdIndex(propsMap);
    const getValue = makeGetValue(pathToProps);

    // Diagnostic: log what Bases provides when logs are enabled in settings
    try {
      const settingsLogsOn = !!(controller?.plugin?.settings?.basesPOCLogs);
      if (settingsLogsOn) {
        console.debug('[TaskNotes][Bases] DIAGNOSTIC - fullCfg keys:', Object.keys(fullCfg));
        console.debug('[TaskNotes][Bases] DIAGNOSTIC - fullCfg:', fullCfg);
      }
    } catch (_) { /* ignore */ }

    // Prefer reading custom keys from fullCfg.data (as seen in your environment)
    const data = (fullCfg as any)?.data ?? {};

    // Read custom config under tasknotes.tasklist (or tasknote.tasklist)
    // Bases may provide dotted keys under fullCfg.data
    let tn = data['tasknotes.tasklist']
      ?? data?.tasknotes?.tasklist
      ?? (fullCfg as any)['tasknotes.tasklist']
      ?? (fullCfg as any)?.tasknotes?.tasklist
      ?? (fullCfg as any)['tasknote.tasklist']
      ?? (fullCfg as any)?.tasknote?.tasklist;
    if (!tn) {
      try {
        tn = query?.getViewConfig?.('tasknotes.tasklist')
          ?? (query?.getViewConfig?.('tasknotes') as any)?.tasklist;
      } catch (_) { /* ignore */ }
    }

    let row3Ids: string[] | undefined;
    let row4Ids: string[] | undefined;

    // Debug logging (support both full config and query lookups)
    let debug = !!(data['tasknotes.debug']
      ?? data?.tasknotes?.debug
      ?? (fullCfg as any)['tasknotes.debug']
      ?? (fullCfg as any)?.tasknotes?.debug);
    if (!debug) {
      try {
        debug = !!(query?.getViewConfig?.('tasknotes.debug')
          ?? (query?.getViewConfig?.('tasknotes') as any)?.debug);
      } catch (_) { /* ignore */ }
    }
    if (debug) {
      console.debug('[TaskNotes][Bases] tasklist-rows config detected:', tn);
    }

    if (tn) {
      if (Array.isArray(tn)) {
        // Array of objects e.g., [{ 'row.3': [...] }, { 'row.4': [...] }]
        if (debug) console.debug('[TaskNotes][Bases] Processing array form:', tn);
        for (const entry of tn) {
          if (!entry || typeof entry !== 'object') continue;
          if ((entry as any)['row.3']) row3Ids = normalizeTokens((entry as any)['row.3'], idIndex);
          if ((entry as any)['row.4']) row4Ids = normalizeTokens((entry as any)['row.4'], idIndex);
        }
      } else if (typeof tn === 'object') {
        // Object forms: { 'row.3': [...], 'row.4': [...] } or { rows: { '3': [...], '4': [...] } }
        if (debug) console.debug('[TaskNotes][Bases] Processing object form:', tn);
        if ((tn as any)['row.3'] || (tn as any)['row.4']) {
          row3Ids = normalizeTokens((tn as any)['row.3'], idIndex);
          row4Ids = normalizeTokens((tn as any)['row.4'], idIndex);
        } else if ((tn as any).rows) {
          row3Ids = normalizeTokens((tn as any).rows?.['3'], idIndex);
          row4Ids = normalizeTokens((tn as any).rows?.['4'], idIndex);
        }
      }
    }

    // Log parsed rows when logs are enabled in settings
    try {
      const settingsLogsOn = !!(controller?.plugin?.settings?.basesPOCLogs);
      if (settingsLogsOn) {
        console.log('[TaskNotes][Bases] PARSED_ROWS_UNCONDITIONAL:', { row3Ids, row4Ids });
      }
    } catch (_) { /* ignore */ }

    if (debug) {
      console.debug('[TaskNotes][Bases] Parsed rows:', { row3Ids, row4Ids });
    }

    // Fallback: if no row3 configured, use Bases 'order'
    if (!row3Ids || row3Ids.length === 0) {
      let order: string[] | undefined;
      try {
        order = (query?.getViewConfig?.('order') as string[] | undefined)
          ?? (fullCfg as any)?.order
          ?? (fullCfg as any)?.columns?.order;
      } catch (_) {
        order = (fullCfg as any)?.order ?? (fullCfg as any)?.columns?.order;
      }
      if (Array.isArray(order)) {
        row3Ids = normalizeTokens(order, idIndex);
      }
    }

    const rows: TasklistRows = {};

    // Helper: parse optional per-field overrides from config token
    // Accept forms like: 'note.assignee' or { 'note.assignee': { overrideDisplayName: string|null|"", displayNameSuffix: string|null|"" } }
    const parseToken = (token: any): { id: string; overrideDisplayName?: string | null; displayNameSuffix?: string | null } | null => {
      if (typeof token === 'string') return { id: token };
      if (token && typeof token === 'object') {
        const keys = Object.keys(token);
        if (keys.length === 1) {
          const id = keys[0];
          const cfg = (token as any)[id] || {};
          return {
            id,
            overrideDisplayName: (cfg?.overrideDisplayName ?? undefined),
            displayNameSuffix: (cfg?.displayNameSuffix ?? undefined)
          };
        }
      }
      return null;
    };

    // Re-parse tn to capture overrides per row
    let row3Tokens: Array<{ id: string; overrideDisplayName?: string | null; displayNameSuffix?: string | null }> | undefined;
    let row4Tokens: Array<{ id: string; overrideDisplayName?: string | null; displayNameSuffix?: string | null }> | undefined;
    if (tn) {
      const extractArray = (arrLike: any): any[] => (Array.isArray(arrLike) ? arrLike : []);
      if (Array.isArray(tn)) {
        for (const entry of tn) {
          if (!entry || typeof entry !== 'object') continue;
          if ((entry as any)['row.3']) row3Tokens = extractArray((entry as any)['row.3']).map(parseToken).filter(Boolean) as any[];
          if ((entry as any)['row.4']) row4Tokens = extractArray((entry as any)['row.4']).map(parseToken).filter(Boolean) as any[];
        }
      } else if (typeof tn === 'object') {
        if ((tn as any)['row.3'] || (tn as any)['row.4']) {
          row3Tokens = extractArray((tn as any)['row.3']).map(parseToken).filter(Boolean) as any[];
          row4Tokens = extractArray((tn as any)['row.4']).map(parseToken).filter(Boolean) as any[];
        } else if ((tn as any).rows) {
          row3Tokens = extractArray((tn as any).rows?.['3']).map(parseToken).filter(Boolean) as any[];
          row4Tokens = extractArray((tn as any).rows?.['4']).map(parseToken).filter(Boolean) as any[];
        }
      }
    }

    const makeRow = (ids?: string[], tokens?: Array<{ id: string; overrideDisplayName?: string | null; displayNameSuffix?: string | null }>): BasesRowConfig | undefined => {
      if (!ids || ids.length === 0) return undefined;
      const tokenMap = new Map<string, { overrideDisplayName?: string | null; displayNameSuffix?: string | null }>();
      (tokens || []).forEach(t => tokenMap.set(t.id, { overrideDisplayName: t.overrideDisplayName, displayNameSuffix: t.displayNameSuffix }));
      const selected = ids.map(id => {
        const baseDisplay = propsMap?.[id]?.getDisplayName?.() ?? id;
        const overrides = tokenMap.get(id);
        let tnLabel: string | null | undefined = undefined;
        if (overrides && ('overrideDisplayName' in overrides)) {
          const ov = overrides.overrideDisplayName;
          tnLabel = (ov === '' ? null : ov);
        }
        let tnSeparator: string | undefined = undefined;
        if (overrides && ('displayNameSuffix' in overrides)) {
          const sep = overrides.displayNameSuffix;
          tnSeparator = (sep === '' ? '' : typeof sep === 'string' ? sep : undefined);
        }
        return {
          id,
          displayName: baseDisplay,
          visible: true,
          tnLabel,
          tnSeparator
        } as BasesSelectedProperty;
      });
      return { selected, getValue };
    };

    rows.row3 = makeRow(row3Ids, row3Tokens);
    rows.row4 = makeRow(row4Ids, row4Tokens);

    return rows;
  } catch (e) {
    console.debug('[TaskNotes][Bases] getTaskNotesTasklistRows failed:', e);
    return {};
  }
}

