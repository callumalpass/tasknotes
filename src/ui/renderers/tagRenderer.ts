// Tag rendering utilities following TaskNotes coding standards

/** Render a single tag string as an Obsidian-like tag element */
export function renderTag(container: HTMLElement, tag: string): void {
  if (!tag || typeof tag !== 'string') return;

  const normalized = normalizeTag(tag);
  if (!normalized) return;

  const el = container.createEl('a', {
    cls: 'tag',
    text: normalized,
    attr: { 'href': normalized }
  });
}

/** Render a list or single tag value into a container */
export function renderTagsValue(container: HTMLElement, value: unknown): void {
  if (typeof value === 'string') {
    renderTag(container, value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((t, idx) => {
      if (idx > 0) container.appendChild(document.createTextNode(' '));
      renderTag(container, String(t));
    });
    return;
  }
  // Fallback: not a recognizable tag value
  if (value != null) container.appendChild(document.createTextNode(String(value)));
}

/** Normalize arbitrary tag strings into #tag form */
export function normalizeTag(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (s.startsWith('#')) return s;
  return `#${s}`;
}

