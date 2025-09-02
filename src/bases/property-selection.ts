import type { TaskCardOptions } from '../ui/TaskCard';

export interface BasesSelectedProperty { id: string; displayName: string; visible: boolean }
export interface BasesPropertyRowConfig {
  selected: BasesSelectedProperty[];
  getValue: (taskPath: string, propId: string) => unknown;
}

function isNonEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function getBasesPropertyRowConfig(basesContainer: any, pathToProps: Map<string, any>): BasesPropertyRowConfig | null {
  try {
    const controller = (basesContainer?.controller ?? basesContainer) as any;
    const query = (basesContainer?.query ?? controller?.query) as any;

    if (!controller) return null;

    // Build index from available properties
    const propsMap: Record<string, any> | undefined = query?.properties;
    const idIndex = new Map<string, string>();
    if (propsMap && typeof propsMap === 'object') {
      for (const id of Object.keys(propsMap)) {
        idIndex.set(id, id);
        const last = id.includes('.') ? id.split('.').pop()! : id;
        idIndex.set(last, id);
        const dn = propsMap[id]?.getDisplayName?.();
        if (typeof dn === 'string' && dn.trim()) idIndex.set(dn.toLowerCase(), id);
      }
    }

    const normalizeToId = (token: string): string | undefined => {
      if (!token) return undefined;
      return idIndex.get(token) || idIndex.get(token.toLowerCase()) || token;
    };

    // Determine visible selection exclusively from the 'order' section (Bases standard)
    const fullCfg = controller?.getViewConfig?.() ?? {};

    // Try multiple locations to fetch order
    let order: string[] | undefined;
    try {
      order = (query?.getViewConfig?.('order') as string[] | undefined)
        ?? (fullCfg as any)?.order
        ?? (fullCfg as any)?.columns?.order;
    } catch (_) {
      order = (fullCfg as any)?.order ?? (fullCfg as any)?.columns?.order;
    }

    // If no order is defined, do not render a third row (avoid showing everything)
    if (!order || !Array.isArray(order) || order.length === 0) return null;

    // Build the selection list strictly from the order tokens
    const orderedIds: string[] = order
      .map(normalizeToId)
      .filter((id): id is string => !!id);

    const selected = orderedIds.map(id => ({
      id,
      displayName: propsMap?.[id]?.getDisplayName?.() ?? id,
      visible: true
    }));

    // Debug logging
    try {
      const tnCfg = (fullCfg?.tasknotes ?? {}) as any;
      const debug = !!(tnCfg?.debug ?? fullCfg?.['tasknotes.debug']);
      if (debug) {
        console.debug('[TaskNotes][Bases] Third-row selection from order:', { orderedIds, selected });
        // Log up to 3 samples of available keys per item for formula detection
        let sampled = 0;
        for (const [_path, props] of pathToProps.entries()) {
          console.debug('[TaskNotes][Bases] Sample properties keys for', _path, Object.keys(props || {}));
          if (++sampled >= 3) break;
        }
      }
    } catch (_) { /* ignore */ }

    const getValue = (taskPath: string, propId: string): unknown => {
      const props = pathToProps.get(taskPath) || {};
      const v = props[propId];
      if (isNonEmpty(v)) return v;
      const last = propId.includes('.') ? propId.split('.').pop()! : propId;
      return props[last];
    };

    return { selected, getValue };
  } catch (e) {
    console.debug('[TaskNotes][Bases] getBasesPropertyRowConfig failed:', e);
    return null;
  }
}

