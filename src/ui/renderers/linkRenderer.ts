// Link and tag rendering utilities for UI components

import { App, TFile } from 'obsidian';

/** Minimal services required to render internal links (DI-friendly) */
export interface LinkServices {
  metadataCache: App['metadataCache'];
  workspace: App['workspace'];
}

const LINK_REGEX = /\[\[([^\[\]]+)\]\]|\[([^\]]+)\]\(([^)]+)\)/g;

/** Append an Obsidian internal link element with hover and open behaviors */
export function appendInternalLink(
  container: HTMLElement,
  filePath: string,
  displayText: string,
  deps: LinkServices
): void {
  const linkEl = container.createEl('a', {
    cls: 'internal-link',
    text: displayText,
    attr: {
      'data-href': filePath,
      'role': 'link',
      'tabindex': '0'
    }
  });

  linkEl.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const file = deps.metadataCache.getFirstLinkpathDest(filePath, '');
      if (file instanceof TFile) {
        await deps.workspace.getLeaf(false).openFile(file);
      }
    } catch (error) {
      console.error('[TaskNotes] Error opening internal link:', { filePath, error });
    }
  });

  linkEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      (linkEl as HTMLElement).click();
    }
  });

  linkEl.addEventListener('mouseover', (event) => {
    const file = deps.metadataCache.getFirstLinkpathDest(filePath, '');
    if (file instanceof TFile) {
      deps.workspace.trigger('hover-link', {
        event,
        source: 'tasknotes-property-link',
        hoverParent: container,
        targetEl: linkEl,
        linktext: filePath,
        sourcePath: file.path
      } as any);
    }
  });
}

/** Render a text string, converting WikiLinks and Markdown links */
export interface RenderLinksOptions {
  renderPlain?: (container: HTMLElement, text: string, deps: LinkServices) => void;
}

export function renderTextWithLinks(
  container: HTMLElement,
  text: string,
  deps: LinkServices,
  options?: RenderLinksOptions
): void {
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = LINK_REGEX.exec(text)) !== null) {
    const [full, wikiInner, mdText, mdHref] = match as any;
    const start = match.index;

    if (start > lastIndex) {
      container.appendChild(document.createTextNode(text.slice(lastIndex, start)));
    }

    if (wikiInner) {
      const content = wikiInner;
      let filePath = content;
      let displayText = content;
      if (content.includes('|')) {
        const [fp, alias] = content.split('|');
        filePath = fp;
        displayText = alias;
      }
      appendInternalLink(container, filePath, displayText, deps);
    } else if (mdText && mdHref) {
      const href = String(mdHref).trim();
      const disp = String(mdText).trim();
      if (/^[a-z]+:\/\//i.test(href)) {
        const a = container.createEl('a', { text: disp, attr: { href, target: '_blank', rel: 'noopener' } });
        a.classList.add('external-link');
      } else {
        appendInternalLink(container, href, disp, deps);
      }
    }

    lastIndex = start + full.length;
  }

  if (lastIndex < text.length) {
    container.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
}

/** Render a value (string or string[]) with link support */
export function renderValueWithLinks(
  container: HTMLElement,
  value: unknown,
  deps: LinkServices
): void {
  if (typeof value === 'string') {
    renderTextWithLinks(container, value, deps);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, idx) => {
      if (idx > 0) container.appendChild(document.createTextNode(', '));
      if (typeof item === 'string') renderTextWithLinks(container, item, deps);
      else container.appendChild(document.createTextNode(String(item)));
    });
    return;
  }
  container.appendChild(document.createTextNode(String(value)));
}

