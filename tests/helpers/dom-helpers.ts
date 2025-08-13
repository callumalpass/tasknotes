export function augmentEl(el: HTMLElement): HTMLElement {
  (el as any).createDiv = function(attrs?: any) {
    const child = document.createElement('div');
    if (typeof attrs === 'string') child.className = attrs;
    else if (attrs?.cls) child.className = attrs.cls;
    this.appendChild(child);
    // Add the same helpers to children for nested usage
    augmentEl(child);
    return child;
  };
  (el as any).createEl = function(tag: string, attrs?: any) {
    const child = document.createElement(tag);
    if (typeof attrs === 'string') child.className = attrs;
    else {
      if (attrs?.cls) child.className = attrs.cls;
      if (attrs?.text) child.textContent = attrs.text;
      if (attrs?.attr) {
        Object.entries(attrs.attr).forEach(([k, v]) => child.setAttribute(k, String(v)));
      }
    }
    this.appendChild(child);
    augmentEl(child as HTMLElement);
    return child;
  };
  (el as any).empty = function() { this.innerHTML=''; return this; };
  (el as any).addClass = function(...classes: string[]) { this.classList.add(...classes); return this; };
  (el as any).removeClass = function(...classes: string[]) { this.classList.remove(...classes); return this; };
  return el;
}

export function makeContainer(): HTMLElement {
  return augmentEl(document.createElement('div'));
}

