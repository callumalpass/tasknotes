import TaskNotesPlugin from '../../../src/main';
import { TaskNotesSettingTab } from '../../../src/settings/TaskNotesSettingTab';
import { DEFAULT_SETTINGS } from '../../../src/settings/defaults';
import { createI18nService } from '../../../src/i18n';

// Obsidian's HTMLElement shim exposes appendText and setAttr; add minimal polyfill for jsdom
(HTMLElement.prototype as any).appendText ??= function (text: string) {
  this.appendChild(document.createTextNode(text));
};
(HTMLElement.prototype as any).setAttr ??= function (name: string, value: string) {
  this.setAttribute(name, value);
};

// Lightweight DOM test for the settings section

describe('Settings UI - User Fields (optional)', () => {
  test('renders under Field mapping tab with expected controls (multi-field)', async () => {
    // Provide Platform mock expected by settings.ts
    (global as any).Platform = { isMobile: false };

    const app: any = {
      workspace: { onLayoutReady: (fn: any) => fn() },
      metadataCache: {},
      vault: { getConfig: jest.fn().mockReturnValue(false) }
    };
    const plugin = new TaskNotesPlugin(app);
    // inject defaults
    (plugin as any).settings = { ...DEFAULT_SETTINGS };
    (plugin as any).i18n = createI18nService();
    (plugin as any).registerEvent = jest.fn();
    (plugin as any).manifest = { version: '0.0.0' };

    const tab = new TaskNotesSettingTab(app, plugin);
    tab.display();

    // Switch to field-mapping tab
    (tab as any).switchTab('task-properties');

    const container = (tab as any).tabContents['task-properties'];
    // Heading text may not render in mock; verify controls/descriptions instead
    expect(container.textContent).toContain('Custom User Fields');
    expect(container.textContent).toContain('Define custom frontmatter properties');
    expect(container.textContent).toContain('Display Name');
    expect(container.textContent).toContain('Property Name');
    expect(container.textContent).toContain('Type');
    expect(container.textContent).toContain('Add user field');
  });
});
