// Tag rendering utilities following TaskNotes coding standards

export interface TagServices {
  onTagClick?: (tag: string, event: MouseEvent) => void;
}

/** Render a single tag string as an Obsidian-like tag element */
export function renderTag(
  container: HTMLElement, 
  tag: string, 
  services?: TagServices
): void {
  if (!tag || typeof tag !== 'string') return;

  const normalized = normalizeTag(tag);
  if (!normalized) return;

  const el = container.createEl('a', {
    cls: 'tag',
    text: normalized,
    attr: { 
      'href': normalized,
      'role': 'button',
      'tabindex': '0'
    }
  });

  // Add click handler if provided
  if (services?.onTagClick) {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      services.onTagClick!(normalized, e as MouseEvent);
    });
    
    // Add keyboard support
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        services.onTagClick!(normalized, e as any);
      }
    });
  }
}

/** Render a list or single tag value into a container */
export function renderTagsValue(
  container: HTMLElement, 
  value: unknown, 
  services?: TagServices
): void {
  if (typeof value === 'string') {
    renderTag(container, value, services);
    return;
  }
  if (Array.isArray(value)) {
    const validTags = value
      .flat(2)
      .filter(t => t !== null && t !== undefined && typeof t === 'string');
      
    validTags.forEach((t, idx) => {
      if (idx > 0) container.appendChild(document.createTextNode(' '));
      renderTag(container, String(t), services);
    });
    return;
  }
  // Fallback: not a recognizable tag value
  if (value != null) container.appendChild(document.createTextNode(String(value)));
}

/** Render contexts with @ prefix */
export function renderContextsValue(
  container: HTMLElement, 
  value: unknown,
  services?: TagServices
): void {
  if (typeof value === 'string') {
    const normalized = normalizeContext(value);
    if (normalized) {
      const el = container.createEl('span', {
        cls: 'context-tag',
        text: normalized,
        attr: {
          'role': 'button',
          'tabindex': '0'
        }
      });
      
      if (services?.onTagClick) {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          services.onTagClick!(normalized, e as MouseEvent);
        });
        
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            services.onTagClick!(normalized, e as any);
          }
        });
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    const validContexts = value
      .flat(2)
      .filter(c => c !== null && c !== undefined && typeof c === 'string');
      
    validContexts.forEach((context, idx) => {
      if (idx > 0) container.appendChild(document.createTextNode(', '));
      renderContextsValue(container, context, services);
    });
    return;
  }
  // Fallback
  if (value != null) container.appendChild(document.createTextNode(String(value)));
}

/** Normalize arbitrary tag strings into #tag form */
export function normalizeTag(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (s.startsWith('#')) return s;
  return `#${s}`;
}

/** Normalize context strings into @context form */
export function normalizeContext(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (s.startsWith('@')) return s;
  return `@${s}`;
}